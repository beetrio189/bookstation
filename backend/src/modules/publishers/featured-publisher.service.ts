import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { UserStatus } from '../../utils/enums/user-status.enum';
import { Book, ContributorRole } from '../books/entities/book.entity';
import { REDIS_CLIENT } from '../redis/redis.module';
import { ACTIVE_PERIOD } from '../subscriptions/plan-subscribers';

const CACHE_KEY = 'home:featured-publisher';
const CACHE_TTL_SECONDS = 3600;
const BOOKS_LIMIT = 7;

export interface FeaturedPublisher {
  publisher?: {
    id: string;
    name: string;
    slug: string;
    logoPublicId: string | null;
  };
  books?: {
    id: string;
    slug: string;
    title: string;
    coverPublicId: string | null;
    authors: string[];
    ratingAvg: number | null;
    ratingCount: number;
  }[];
}

/**
 * NXB đủ điều kiện lên hàng "Sách mới từ NXB …": tài khoản không bị khóa, đang có
 * gói trả phí còn hiệu lực (gói Free không có dòng payments), có ít nhất 1 sách.
 * $1 = trạng thái active.
 */
const ELIGIBLE = `
  JOIN users u ON u.id = p.user_id AND u.status = $1
  WHERE EXISTS (SELECT 1 FROM payments pm WHERE pm.publisher_id = p.id AND ${ACTIVE_PERIOD})
    AND EXISTS (SELECT 1 FROM books b WHERE b.publisher_id = p.id)`;

@Injectable()
export class FeaturedPublisherService {
  private readonly logger = new Logger(FeaturedPublisherService.name);

  constructor(
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async get(): Promise<FeaturedPublisher> {
    const cachedId = await this.readCache();

    if (cachedId) {
      const publisher = await this.findEligible(cachedId);

      if (publisher) {
        return { publisher, books: await this.newestBooks(publisher.id) };
      }

      await this.redis.del(CACHE_KEY).catch(() => undefined);
    }

    const pickedId = await this.drawPublisherId();
    const publisher = pickedId && (await this.findEligible(pickedId));

    if (!publisher) {
      return {};
    }

    await this.redis
      .set(CACHE_KEY, publisher.id, 'EX', CACHE_TTL_SECONDS)
      .catch((error: Error) =>
        this.logger.error(`Không lưu được NXB nổi bật: ${error.message}`),
      );

    return { publisher, books: await this.newestBooks(publisher.id) };
  }

  private async readCache(): Promise<string | null> {
    try {
      return await this.redis.get(CACHE_KEY);
    } catch (error) {
      this.logger.error(
        `Không đọc được NXB nổi bật: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private async findEligible(
    id: string,
  ): Promise<FeaturedPublisher['publisher'] | undefined> {
    const [row] = await this.dataSource.query<
      NonNullable<FeaturedPublisher['publisher']>[]
    >(
      `SELECT p.id, p.publisher_name AS name, p.slug, p.logo_public_id AS "logoPublicId"
       FROM publishers p ${ELIGIBLE} AND p.id = $2`,
      [UserStatus.ACTIVE, id],
    );

    return row;
  }

  /**
   * Bốc thăm theo trọng số (featured_weight của payment đang hiệu lực; mỗi NXB có
   * tối đa 1 vì mua gói mới thì kết thúc gói cũ ngay):
   * xếp vé các NXB nối tiếp nhau, bốc một vé trong [0, tổng), NXB đầu tiên có
   * số vé cộng dồn vượt qua vé đó trúng → xác suất = trọng số / tổng trọng số.
   */
  private async drawPublisherId(): Promise<string | undefined> {
    const rows = await this.dataSource.query<{ id: string; weight: number }[]>(
      `SELECT p.id, pm.featured_weight AS weight
       FROM publishers p
       JOIN users u ON u.id = p.user_id AND u.status = $1
       JOIN payments pm ON pm.publisher_id = p.id AND ${ACTIVE_PERIOD}
       WHERE EXISTS (SELECT 1 FROM books b WHERE b.publisher_id = p.id)`,
      [UserStatus.ACTIVE],
    );
    const total = rows.reduce((sum, row) => sum + row.weight, 0);
    const ticket = Math.random() * total;
    let cum = 0;

    for (const row of rows) {
      cum += row.weight;

      if (cum > ticket) {
        return row.id;
      }
    }

    return undefined;
  }

  /** 7 sách mới nhất (index books (publisher_id, created_at DESC)); authors = tên người có role author */
  private async newestBooks(
    publisherId: string,
  ): Promise<NonNullable<FeaturedPublisher['books']>> {
    const books = await this.dataSource.manager.find(Book, {
      select: {
        id: true,
        slug: true,
        title: true,
        coverPublicId: true,
        contributors: true,
        ratingAvg: true,
        ratingCount: true,
      },
      where: { publisherId },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: BOOKS_LIMIT,
    });

    return books.map((book) => ({
      id: book.id,
      slug: book.slug,
      title: book.title,
      coverPublicId: book.coverPublicId,
      authors: book.contributors
        .filter((c) => c.role === ContributorRole.AUTHOR)
        .map((c) => c.name),
      ratingAvg: book.ratingAvg,
      ratingCount: book.ratingCount,
    }));
  }
}
