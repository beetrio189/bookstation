import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { isUniqueViolation } from '../../utils/database-errors';
import { RoleCode } from '../../utils/enums/role-code.enum';
import { SystemActionType } from '../../utils/enums/system-action-type.enum';
import { AppException } from '../../utils/errors/app.exception';
import { ERRORS } from '../../utils/errors/errors';
import { escapeLike } from '../../utils/escape-like';
import { nextFreeSlug, slugify } from '../../utils/slug';
import type { AuthUser } from '../../utils/types/auth-user';
import { writeSystemLog } from '../admin/write-system-log';
import { CoverUploadSignature, signCoverUpload } from '../books/cover';
import {
  COVER_TICKET_TTL_SECONDS,
  coverPublicId,
  coverTicketKey,
} from '../books/cover.constants';
import { CoverQueueService } from '../books/cover-queue.service';
import { Book, type Contributor } from '../books/entities/book.entity';
import { Genre } from '../genres/entities/genre.entity';
import { REDIS_CLIENT } from '../redis/redis.module';
import { currentLimits } from '../subscriptions/current-limits';
import { BookDto } from './dto/book.dto';
import {
  ListPublisherBooksQuery,
  UNCATEGORIZED,
} from './dto/list-publisher-books.query';
import { Publisher } from './entities/publisher.entity';
import { findPublisherId } from './find-publisher-id';

const FUZZY_MIN_LENGTH = 3;
const SLUG_FALLBACK = 'sach';

export interface PublisherBookItem {
  id: string;
  title: string;
  slug: string;
  coverPublicId: string | null;
  contributors: Contributor[];
  genres: { id: string; name: string }[];
  ratingAvg: number | null;
  ratingCount: number;
  createdAt: Date;
}

export interface PublisherBookDetail extends PublisherBookItem {
  description: string | null;
  publishedYear: number | null;
  updatedAt: Date;
}

export interface BookCreated {
  id: string;
  slug: string;
  title: string;
  createdAt: Date;
}

export interface PublisherBookPage {
  items: PublisherBookItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const toContributors = (items: Contributor[]): Contributor[] =>
  items.map(({ name, role }) => ({ name, role }));

@Injectable()
export class PublisherBooksService {
  private readonly logger = new Logger(PublisherBooksService.name);

  constructor(
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly coverQueueService: CoverQueueService,
  ) {}

  /**
   * Sách của NXB mà user là chủ hoặc biên tập viên. q tìm cả tên sách lẫn tên
   * contributors (search_text); genres (phẩy) lọc AND: sách phải có ĐỦ mọi thể loại;
   * "none" = chưa phân loại, chỉ được chọn một mình.
   */
  async list(
    user: AuthUser,
    { page, limit, q, genres = [] }: ListPublisherBooksQuery,
  ): Promise<PublisherBookPage> {
    if (genres.includes(UNCATEGORIZED) && genres.length > 1) {
      throw new AppException(
        ERRORS.VALIDATION_ERROR,
        'Không thể chọn "Chưa phân loại" cùng thể loại khác',
      );
    }

    const query = this.selectBooks(await this.publisherIdOf(user));

    if (genres[0] === UNCATEGORIZED) {
      query.andWhere(
        'NOT EXISTS (SELECT 1 FROM book_genres bg WHERE bg.book_id = book.id)',
      );
    } else {
      [...new Set(genres.map((id) => id.toLowerCase()))].forEach(
        (genreId, i) => {
          query.andWhere(
            `EXISTS (SELECT 1 FROM book_genres bg WHERE bg.book_id = book.id AND bg.genre_id = :genre${i})`,
            { [`genre${i}`]: genreId },
          );
        },
      );
    }

    if (q) {
      if (Array.from(q).length < FUZZY_MIN_LENGTH) {
        query.andWhere('book.search_text LIKE f_unaccent(lower(:like))', {
          like: `%${escapeLike(q)}%`,
        });
      } else {
        query
          .andWhere('f_unaccent(lower(:q)) <% book.search_text', { q })
          .orderBy(
            'word_similarity(f_unaccent(lower(:q)), book.search_text)',
            'DESC',
          );
      }
    }

    const total = await query.clone().getCount();
    const items = await query
      .addOrderBy('book.created_at', 'DESC')
      .addOrderBy('book.id', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<PublisherBookItem>();

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Chi tiết để mở form sửa; sách không có hoặc của NXB khác → 404 */
  async findOne(user: AuthUser, id: string): Promise<PublisherBookDetail> {
    return this.detail(await this.publisherIdOf(user), id);
  }

  /**
   * Chữ ký để FE upload ảnh bìa thẳng lên Cloudinary. public_id do BE sinh và
   * ghi vé cover:<public_id> → publisherId (1 giờ): lúc lưu sách chỉ nhận ảnh
   * có vé của đúng NXB này. Không ghi được vé thì không trả chữ ký.
   */
  async requestCoverUpload(user: AuthUser): Promise<CoverUploadSignature> {
    const publisherId = await this.publisherIdOf(user);
    const publicId = coverPublicId(randomUUID());

    try {
      await this.redis.set(
        coverTicketKey(publicId),
        publisherId,
        'EX',
        COVER_TICKET_TTL_SECONDS,
      );
    } catch (error) {
      throw new AppException(
        ERRORS.SERVICE_UNAVAILABLE,
        undefined,
        undefined,
        error,
      );
    }

    return signCoverUpload(publicId);
  }

  /**
   * Khóa dòng publishers (ổ khóa riêng của NXB) rồi mới đếm sách: hai người
   * thêm cùng lúc phải xếp hàng, không vượt book_limit của gói hiện tại.
   */
  async create(user: AuthUser, dto: BookDto): Promise<BookCreated> {
    const publisherId = await this.publisherIdOf(user);

    if (dto.coverPublicId) {
      await this.assertCoverTicket(publisherId, dto.coverPublicId);
    }

    let book: Book;

    try {
      book = await this.dataSource.transaction(async (manager) => {
        await manager.findOne(Publisher, {
          where: { id: publisherId },
          lock: { mode: 'pessimistic_write' },
        });

        const { bookLimit } = await currentLimits(manager, publisherId);
        const count = await manager.countBy(Book, { publisherId });

        if (count >= bookLimit) {
          throw new AppException(ERRORS.BOOK_LIMIT_REACHED);
        }

        await this.assertGenresExist(manager, dto.genreIds);

        const created = await manager.save(
          manager.create(Book, {
            publisherId,
            title: dto.title,
            slug: await this.freeSlug(manager, dto.title),
            description: dto.description || null,
            contributors: toContributors(dto.contributors),
            publishedYear: dto.publishedYear ?? null,
            coverPublicId: dto.coverPublicId ?? null,
          }),
        );

        await this.addGenres(manager, created.id, dto.genreIds);
        await writeSystemLog(manager, user.id, {
          actionType: SystemActionType.BOOK_CREATION,
          targetId: created.id,
          targetName: created.title,
          note: dto.note,
        });

        return created;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppException(ERRORS.BOOK_SLUG_CONFLICT);
      }

      throw error;
    }

    if (dto.coverPublicId) {
      await this.consumeCoverTicket(dto.coverPublicId);
    }

    return {
      id: book.id,
      slug: book.slug,
      title: book.title,
      createdAt: book.createdAt,
    };
  }

  /**
   * PUT: body là cả sách (giống POST). Vẫn so từng trường với DB, chỉ ghi khi
   * có đổi; không đổi gì → NOTHING_TO_UPDATE. Đổi tên
   * thì slug đổi theo (link cũ hỏng, chấp nhận). Hai người cùng sửa: người lưu
   * sau thắng. Bìa cũ bị thay / gỡ thì xóa trên Cloudinary qua job sau commit.
   */
  async update(
    user: AuthUser,
    id: string,
    dto: BookDto,
  ): Promise<PublisherBookDetail> {
    const publisherId = await this.publisherIdOf(user);

    let oldCover: string | null;

    try {
      oldCover = await this.dataSource.transaction(async (manager) => {
        const book = await this.lockBook(manager, id, publisherId);
        const before = book.coverPublicId;
        let changed = false;

        const description = dto.description || null;
        const publishedYear = dto.publishedYear ?? null;
        const coverPublicId = dto.coverPublicId ?? null;
        const contributors = toContributors(dto.contributors);

        if (dto.title !== book.title) {
          book.title = dto.title;
          book.slug = await this.freeSlug(manager, dto.title, id);
          changed = true;
        }

        if (description !== book.description) {
          book.description = description;
          changed = true;
        }

        if (publishedYear !== book.publishedYear) {
          book.publishedYear = publishedYear;
          changed = true;
        }

        if (
          JSON.stringify(contributors) !== JSON.stringify(book.contributors)
        ) {
          book.contributors = contributors;
          changed = true;
        }

        if (coverPublicId !== book.coverPublicId) {
          if (coverPublicId) {
            await this.assertCoverTicket(publisherId, coverPublicId);
          }

          book.coverPublicId = coverPublicId;
          changed = true;
        }

        const genresChanged = await this.syncGenres(manager, id, dto.genreIds);

        if (!changed && !genresChanged) {
          throw new AppException(ERRORS.NOTHING_TO_UPDATE);
        }

        book.updatedAt = new Date();
        await manager.save(book);

        await writeSystemLog(manager, user.id, {
          actionType: SystemActionType.BOOK_UPDATE,
          targetId: id,
          targetName: book.title,
          note: dto.note,
        });

        return before !== book.coverPublicId ? before : null;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppException(ERRORS.BOOK_SLUG_CONFLICT);
      }

      throw error;
    }

    if (dto.coverPublicId) {
      await this.consumeCoverTicket(dto.coverPublicId);
    }

    await this.coverQueueService.enqueueDestroy(oldCover);

    return this.detail(publisherId, id);
  }

  /**
   * Xóa hẳn; book_genres và book_reviews xóa theo (CASCADE), chỉ ghi một dòng
   * book_deletion. Ảnh bìa xóa trên Cloudinary qua job sau commit.
   */
  async remove(
    user: AuthUser,
    id: string,
    note: string,
  ): Promise<Record<string, never>> {
    const publisherId = await this.publisherIdOf(user);

    const cover = await this.dataSource.transaction(async (manager) => {
      const book = await this.lockBook(manager, id, publisherId);

      await manager.delete(Book, { id });
      await writeSystemLog(manager, user.id, {
        actionType: SystemActionType.BOOK_DELETION,
        targetId: id,
        targetName: book.title,
        note,
      });

      return book.coverPublicId;
    });

    await this.coverQueueService.enqueueDestroy(cover);

    return {};
  }

  private async detail(
    publisherId: string,
    id: string,
  ): Promise<PublisherBookDetail> {
    const book = await this.selectBooks(publisherId)
      .addSelect('book.description', 'description')
      .addSelect('book.published_year', 'publishedYear')
      .addSelect('book.updated_at', 'updatedAt')
      .andWhere('book.id = :id', { id })
      .getRawOne<PublisherBookDetail>();

    if (!book) {
      throw new AppException(ERRORS.NOT_FOUND);
    }

    return book;
  }

  private async lockBook(
    manager: EntityManager,
    id: string,
    publisherId: string,
  ): Promise<Book> {
    const book = await manager.findOne(Book, {
      where: { id, publisherId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!book) {
      throw new AppException(ERRORS.NOT_FOUND);
    }

    return book;
  }

  private async assertGenresExist(
    manager: EntityManager,
    genreIds: string[],
  ): Promise<void> {
    const count = await manager.countBy(Genre, { id: In(genreIds) });

    if (count !== genreIds.length) {
      throw new AppException(ERRORS.GENRE_NOT_FOUND);
    }
  }

  private async addGenres(
    manager: EntityManager,
    bookId: string,
    genreIds: string[],
  ): Promise<void> {
    if (genreIds.length > 0) {
      await manager.query(
        'INSERT INTO book_genres (book_id, genre_id) SELECT $1, unnest($2::uuid[])',
        [bookId, genreIds],
      );
    }
  }

  /** Chỉ xóa thể loại bị bỏ, chèn thể loại mới (giữ created_at dòng cũ); trả có đổi không */
  private async syncGenres(
    manager: EntityManager,
    bookId: string,
    genreIds: string[],
  ): Promise<boolean> {
    const rows = await manager.query<{ genreId: string }[]>(
      'SELECT genre_id AS "genreId" FROM book_genres WHERE book_id = $1',
      [bookId],
    );
    const current = new Set(rows.map(({ genreId }) => genreId));
    const wanted = new Set(genreIds);
    const removed = [...current].filter((genreId) => !wanted.has(genreId));
    const added = genreIds.filter((genreId) => !current.has(genreId));

    if (removed.length > 0) {
      await manager.query(
        'DELETE FROM book_genres WHERE book_id = $1 AND genre_id = ANY($2::uuid[])',
        [bookId, removed],
      );
    }

    if (added.length > 0) {
      await this.assertGenresExist(manager, added);
      await this.addGenres(manager, bookId, added);
    }

    return removed.length > 0 || added.length > 0;
  }

  /** Slug unique trên toàn bảng books: base, base-2... (bỏ qua slug của chính sách đang sửa) */
  private async freeSlug(
    manager: EntityManager,
    title: string,
    exceptId?: string,
  ): Promise<string> {
    const base = slugify(title, SLUG_FALLBACK);
    const query = manager
      .createQueryBuilder(Book, 'book')
      .select('book.slug', 'slug')
      .where('book.slug ~ :pattern', { pattern: `^${base}(-[0-9]+)?$` });

    if (exceptId) {
      query.andWhere('book.id <> :exceptId', { exceptId });
    }

    const taken = await query.getRawMany<{ slug: string }>();

    return nextFreeSlug(
      base,
      taken.map(({ slug }) => slug),
    );
  }

  private async assertCoverTicket(
    publisherId: string,
    publicId: string,
  ): Promise<void> {
    let owner: string | null;

    try {
      owner = await this.redis.get(coverTicketKey(publicId));
    } catch (error) {
      throw new AppException(
        ERRORS.SERVICE_UNAVAILABLE,
        undefined,
        undefined,
        error,
      );
    }

    if (owner !== publisherId) {
      throw new AppException(ERRORS.INVALID_COVER);
    }
  }

  private async consumeCoverTicket(publicId: string): Promise<void> {
    try {
      await this.redis.del(coverTicketKey(publicId));
    } catch (error) {
      this.logger.error(
        `Không xóa được vé ảnh bìa ${publicId}: ${(error as Error).message}`,
      );
    }
  }

  private publisherIdOf(user: AuthUser): Promise<string> {
    return findPublisherId(
      this.dataSource.manager,
      user.id,
      user.role === RoleCode.PUBLISHER,
    );
  }

  private selectBooks(publisherId: string) {
    return this.dataSource.manager
      .createQueryBuilder(Book, 'book')
      .select('book.id', 'id')
      .addSelect('book.title', 'title')
      .addSelect('book.slug', 'slug')
      .addSelect('book.cover_public_id', 'coverPublicId')
      .addSelect('book.contributors', 'contributors')
      .addSelect(
        `COALESCE((
          SELECT json_agg(json_build_object('id', g.id, 'name', g.name) ORDER BY g.name, g.id)
          FROM book_genres bg JOIN genres g ON g.id = bg.genre_id
          WHERE bg.book_id = book.id
        ), '[]'::json)`,
        'genres',
      )
      .addSelect('book.rating_avg::float8', 'ratingAvg')
      .addSelect('book.rating_count', 'ratingCount')
      .addSelect('book.created_at', 'createdAt')
      .where('book.publisher_id = :publisherId', { publisherId });
  }
}
