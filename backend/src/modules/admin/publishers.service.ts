import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { EntityManager, In, Repository } from 'typeorm';
import {
  isUniqueViolation,
  violatedConstraint,
} from '../../utils/database-errors';
import { IdentityProvider } from '../../utils/enums/identity-provider.enum';
import { RoleCode } from '../../utils/enums/role-code.enum';
import { SystemActionType } from '../../utils/enums/system-action-type.enum';
import { UserStatus } from '../../utils/enums/user-status.enum';
import { AppException } from '../../utils/errors/app.exception';
import { ERRORS } from '../../utils/errors/errors';
import { nextFreeSlug, slugify } from '../../utils/slug';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { MailJob } from '../mail/mail-queue.constants';
import { MailQueueService } from '../mail/mail-queue.service';
import { Editor } from '../publishers/entities/editor.entity';
import { Publisher } from '../publishers/entities/publisher.entity';
import { REDIS_CLIENT } from '../redis/redis.module';
import { FREE_PLAN_NAME } from '../subscriptions/entities/plan.entity';
import { Provider } from '../users/entities/provider.entity';
import { User } from '../users/entities/user.entity';
import { CreatePublisherDto } from './dto/create-publisher.dto';
import { ListPublishersQuery } from './dto/list-publishers.query';
import { PasswordResetQuota } from './password-reset-quota';
import { writeSystemLog } from './write-system-log';

export interface PublisherCreated {
  id: string;
  email: string;
  publisherName: string;
  slug: string;
  // Tên gói (plans.name), NXB mới luôn ở gói Free 'none'
  subscriptionTier: string;
  createdAt: Date;
}

export interface PublisherListItem {
  id: string;
  publisherName: string;
  status: UserStatus;
  hasPassword: boolean;
}

export interface PublisherPage {
  items: PublisherListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PublisherDetail {
  id: string;
  userId: string;
  email: string;
  publisherName: string;
  logoUrl: string | null;
  description: string | null;
  subscriptionTier: string;
  planEndsAt: Date | null;
  status: UserStatus;
  hasPassword: boolean;
  bookCount: number;
  editorCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublisherEditorItem {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  hasPassword: boolean;
  createdAt: Date;
}

interface LockedPublisher {
  id: string;
  userId: string;
  email: string;
  publisherName: string;
  status: UserStatus;
}

const SLUG_FALLBACK = 'nha-xuat-ban';
const SLUG_CONSTRAINT = 'publishers_slug_key';
const USER_NAME_LENGTH = 100;
const FUZZY_MIN_LENGTH = 3;

const CURRENT_PAYMENT_SQL = `SELECT {col} FROM payments pm
  WHERE pm.publisher_id = publisher.id AND pm.status = 'success'
    AND pm.period_starts_at <= now() AND pm.period_ends_at > now()
  ORDER BY pm.period_ends_at DESC LIMIT 1`;

const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

@Injectable()
export class PublishersService {
  private readonly logger = new Logger(PublishersService.name);
  private readonly resetQuota: PasswordResetQuota;

  constructor(
    @InjectRepository(Publisher)
    private readonly publishersRepository: Repository<Publisher>,
    private readonly mailQueueService: MailQueueService,
    @Inject(REDIS_CLIENT) redis: Redis,
  ) {
    this.resetQuota = new PasswordResetQuota(redis);
  }

  private get manager(): EntityManager {
    return this.publishersRepository.manager;
  }

  /**
   * Tạo user (role publisher, chưa có mật khẩu) + đăng nhập local + hồ sơ NXB
   * + log trong một transaction, rồi đẩy job gửi mật khẩu. Không chặn trùng
   * tên NXB (đơn được duyệt tay qua email); slug trùng thì thêm -2, -3...
   */
  async create(
    actorId: string,
    { email, publisherName, note }: CreatePublisherDto,
  ): Promise<PublisherCreated> {
    let publisher: Publisher;

    try {
      publisher = await this.manager.transaction((manager) =>
        this.insertPublisher(manager, actorId, email, publisherName, note),
      );
    } catch (error) {
      if (
        isUniqueViolation(error) &&
        violatedConstraint(error) !== SLUG_CONSTRAINT
      ) {
        throw new AppException(ERRORS.EMAIL_ALREADY_EXISTS);
      }

      throw error;
    }

    await this.enqueueCredentialsEmail(publisher.userId, email);

    return {
      id: publisher.id,
      email,
      publisherName: publisher.publisherName,
      slug: publisher.slug,
      subscriptionTier: FREE_PLAN_NAME,
      createdAt: publisher.createdAt,
    };
  }

  async list({ page, limit, q }: ListPublishersQuery): Promise<PublisherPage> {
    const query = this.manager
      .createQueryBuilder(Publisher, 'publisher')
      .innerJoin(User, 'user', 'user.id = publisher.user_id')
      .leftJoin(
        Provider,
        'provider',
        'provider.user_id = user.id AND provider.provider = :local',
        { local: IdentityProvider.LOCAL },
      )
      .select('publisher.id', 'id')
      .addSelect('publisher.publisher_name', 'publisherName')
      .addSelect('user.status', 'status')
      .addSelect('provider.password_hash IS NOT NULL', 'hasPassword');

    if (q) {
      if (Array.from(q).length < FUZZY_MIN_LENGTH) {
        query.where('publisher.search_text ILIKE f_unaccent(:like)', {
          like: `%${escapeLike(q)}%`,
        });
      } else {
        query
          .where('f_unaccent(:q) <% publisher.search_text', { q })
          .orderBy(
            'word_similarity(f_unaccent(:q), publisher.search_text)',
            'DESC',
          );
      }
    }

    const total = await query.clone().getCount();
    const items = await query
      .addOrderBy('publisher.created_at', 'DESC')
      .addOrderBy('publisher.id', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<PublisherListItem>();

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<PublisherDetail> {
    const detail = await this.manager
      .createQueryBuilder(Publisher, 'publisher')
      .innerJoin(User, 'user', 'user.id = publisher.user_id')
      .leftJoin(
        Provider,
        'provider',
        'provider.user_id = user.id AND provider.provider = :local',
        { local: IdentityProvider.LOCAL },
      )
      .select('publisher.id', 'id')
      .addSelect('user.id', 'userId')
      .addSelect('provider.provider_key', 'email')
      .addSelect('publisher.publisher_name', 'publisherName')
      .addSelect('publisher.logo_url', 'logoUrl')
      .addSelect('publisher.description', 'description')
      .addSelect(
        `COALESCE((${CURRENT_PAYMENT_SQL.replace('{col}', 'pm.plan_name')}), '${FREE_PLAN_NAME}')`,
        'subscriptionTier',
      )
      .addSelect(
        `(${CURRENT_PAYMENT_SQL.replace('{col}', 'pm.period_ends_at')})`,
        'planEndsAt',
      )
      .addSelect('user.status', 'status')
      .addSelect('provider.password_hash IS NOT NULL', 'hasPassword')
      .addSelect(
        '(SELECT COUNT(*) FROM books b WHERE b.publisher_id = publisher.id)::int',
        'bookCount',
      )
      .addSelect(
        '(SELECT COUNT(*) FROM editors e WHERE e.publisher_id = publisher.id)::int',
        'editorCount',
      )
      .addSelect('publisher.created_at', 'createdAt')
      .addSelect('GREATEST(user.updated_at, publisher.updated_at)', 'updatedAt')
      .where('publisher.id = :id', { id })
      .getRawOne<PublisherDetail>();

    if (!detail) {
      throw new AppException(ERRORS.NOT_FOUND);
    }

    return detail;
  }

  async listEditors(
    publisherId: string,
  ): Promise<{ items: PublisherEditorItem[] }> {
    if (!(await this.manager.existsBy(Publisher, { id: publisherId }))) {
      throw new AppException(ERRORS.NOT_FOUND);
    }

    const items = await this.manager
      .createQueryBuilder(Editor, 'editor')
      .innerJoin(User, 'user', 'user.id = editor.user_id')
      .leftJoin(
        Provider,
        'provider',
        'provider.user_id = user.id AND provider.provider = :local',
        { local: IdentityProvider.LOCAL },
      )
      .select('editor.id', 'id')
      .addSelect('user.name', 'name')
      .addSelect('provider.provider_key', 'email')
      .addSelect('user.status', 'status')
      .addSelect('provider.password_hash IS NOT NULL', 'hasPassword')
      .addSelect('editor.created_at', 'createdAt')
      .where('editor.publisher_id = :publisherId', { publisherId })
      .orderBy('editor.created_at', 'DESC')
      .addOrderBy('editor.id', 'DESC')
      .getRawMany<PublisherEditorItem>();

    return { items };
  }

  /**
   * Như reset KDV, thêm: NXB đang bị khóa thì không reset, tối đa 3 lần/ngày
   * cho mỗi NXB, lý do (ghi chú) in ở cuối email. Biên tập viên không bị ảnh hưởng.
   */
  async resetPassword(
    actorId: string,
    id: string,
    note: string,
  ): Promise<Record<string, never>> {
    await this.resetQuota.take(`publisher:${id}`);

    let publisher: LockedPublisher;

    try {
      publisher = await this.manager.transaction(async (manager) => {
        const target = await this.lockPublisher(manager, id);

        if (target.status === UserStatus.LOCKED) {
          throw new AppException(ERRORS.TARGET_ACCOUNT_LOCKED);
        }

        await manager.update(
          Provider,
          { userId: target.userId, provider: IdentityProvider.LOCAL },
          { passwordHash: null },
        );
        await manager.delete(RefreshToken, { userId: target.userId });

        await writeSystemLog(manager, actorId, {
          actionType: SystemActionType.PUBLISHER_PASSWORD_RESET,
          targetId: id,
          targetName: target.publisherName,
          note,
        });

        return target;
      });
    } catch (error) {
      await this.resetQuota.giveBack(`publisher:${id}`);
      throw error;
    }

    try {
      await this.mailQueueService.enqueueAccountPasswordResetEmail(
        publisher.userId,
        publisher.email,
        'publisher',
        note,
      );
    } catch (error) {
      this.logger.error(error);
      throw new AppException(ERRORS.SERVICE_UNAVAILABLE);
    }

    return {};
  }

  /**
   * Khóa NXB kéo theo khóa mọi biên tập viên của NXB (NXB chỉ xóa được biên
   * tập viên, không tự khóa, nên mở lại thì mở hết), đăng xuất tất cả. Sách
   * vẫn hiện. Khảo sát không bị đổi trạng thái: API độc giả tự lọc bỏ khảo sát
   * của NXB đang khóa (users.status), nên mở khóa là khảo sát hiện lại đúng như cũ.
   */
  async lock(
    actorId: string,
    id: string,
    note: string,
  ): Promise<Record<string, never>> {
    const target = await this.manager.transaction(async (manager) => {
      const target = await this.lockPublisher(manager, id);

      if (target.status === UserStatus.LOCKED) {
        throw new AppException(ERRORS.PUBLISHER_ALREADY_SUSPENDED);
      }

      const userIds = await this.accountIdsOf(manager, target);

      await manager.update(
        User,
        { id: In(userIds) },
        { status: UserStatus.LOCKED },
      );
      await manager.delete(RefreshToken, { userId: In(userIds) });

      await writeSystemLog(manager, actorId, {
        actionType: SystemActionType.PUBLISHER_SUSPENDED,
        targetId: id,
        targetName: target.publisherName,
        note,
      });

      return target;
    });

    await this.enqueueStatusEmail(MailJob.PUBLISHER_SUSPENDED, target, note);

    return {};
  }

  async unlock(
    actorId: string,
    id: string,
    note: string,
  ): Promise<Record<string, never>> {
    const target = await this.manager.transaction(async (manager) => {
      const target = await this.lockPublisher(manager, id);

      if (target.status !== UserStatus.LOCKED) {
        throw new AppException(ERRORS.PUBLISHER_NOT_SUSPENDED);
      }

      await manager.update(
        User,
        { id: In(await this.accountIdsOf(manager, target)) },
        { status: UserStatus.ACTIVE },
      );

      await writeSystemLog(manager, actorId, {
        actionType: SystemActionType.PUBLISHER_UNSUSPENDED,
        targetId: id,
        targetName: target.publisherName,
        note,
      });

      return target;
    });

    await this.enqueueStatusEmail(MailJob.PUBLISHER_UNSUSPENDED, target, note);

    return {};
  }

  /**
   * Xóa hẳn NXB: xóa user của NXB và mọi biên tập viên, khóa ngoại CASCADE xóa
   * tiếp hồ sơ NXB, biên tập viên, sách (kèm thể loại, đánh giá), khảo sát
   * (kèm câu trả lời), lịch sử gói, đăng nhập, refresh token. Chỉ admin.
   */
  async remove(
    actorId: string,
    id: string,
    note: string,
  ): Promise<Record<string, never>> {
    await this.manager.transaction(async (manager) => {
      const target = await this.lockPublisher(manager, id);
      const userIds = await this.accountIdsOf(manager, target);

      await writeSystemLog(manager, actorId, {
        actionType: SystemActionType.PUBLISHER_DELETION,
        targetId: id,
        targetName: target.publisherName,
        note,
      });
      await manager.delete(User, { id: In(userIds) });
    });

    return {};
  }

  private async insertPublisher(
    manager: EntityManager,
    actorId: string,
    email: string,
    publisherName: string,
    note: string,
  ): Promise<Publisher> {
    if (
      await manager.existsBy(Provider, {
        provider: IdentityProvider.LOCAL,
        providerKey: email,
      })
    ) {
      throw new AppException(ERRORS.EMAIL_ALREADY_EXISTS);
    }

    const user = await manager.save(
      manager.create(User, {
        role: RoleCode.PUBLISHER,
        name: Array.from(publisherName).slice(0, USER_NAME_LENGTH).join(''),
        notificationEmail: email,
        notificationEmailVerified: true,
      }),
    );

    await manager.insert(Provider, {
      userId: user.id,
      provider: IdentityProvider.LOCAL,
      providerKey: email,
      verified: true,
      passwordHash: null,
    });

    const base = slugify(publisherName, SLUG_FALLBACK);
    const taken = await manager
      .createQueryBuilder(Publisher, 'publisher')
      .select('publisher.slug', 'slug')
      .where('publisher.slug = :base OR publisher.slug ~ :pattern', {
        base,
        pattern: `^${base}-[0-9]+$`,
      })
      .getRawMany<{ slug: string }>();

    const publisher = await manager.save(
      manager.create(Publisher, {
        userId: user.id,
        publisherName,
        slug: nextFreeSlug(
          base,
          taken.map(({ slug }) => slug),
        ),
      }),
    );

    await writeSystemLog(manager, actorId, {
      actionType: SystemActionType.PUBLISHER_CREATION,
      targetId: publisher.id,
      targetName: publisherName,
      note,
    });

    return publisher;
  }

  private async lockPublisher(
    manager: EntityManager,
    id: string,
  ): Promise<LockedPublisher> {
    const target = await manager
      .createQueryBuilder(Publisher, 'publisher')
      .innerJoin(User, 'user', 'user.id = publisher.user_id')
      .innerJoin(
        Provider,
        'provider',
        'provider.user_id = user.id AND provider.provider = :local',
        { local: IdentityProvider.LOCAL },
      )
      .select('publisher.id', 'id')
      .addSelect('user.id', 'userId')
      .addSelect('provider.provider_key', 'email')
      .addSelect('publisher.publisher_name', 'publisherName')
      .addSelect('user.status', 'status')
      .where('publisher.id = :id', { id })
      .setLock('pessimistic_write')
      .getRawOne<LockedPublisher>();

    if (!target) {
      throw new AppException(ERRORS.NOT_FOUND);
    }

    return target;
  }

  private async accountIdsOf(
    manager: EntityManager,
    publisher: LockedPublisher,
  ): Promise<string[]> {
    const editors = await manager.find(Editor, {
      select: { userId: true },
      where: { publisherId: publisher.id },
    });

    return [publisher.userId, ...editors.map(({ userId }) => userId)];
  }

  private async enqueueCredentialsEmail(
    userId: string,
    email: string,
  ): Promise<void> {
    try {
      await this.mailQueueService.enqueueAccountCredentialsEmail(
        userId,
        email,
        'publisher',
      );
    } catch (error) {
      this.logger.error(error);
    }
  }

  private async enqueueStatusEmail(
    job: MailJob.PUBLISHER_SUSPENDED | MailJob.PUBLISHER_UNSUSPENDED,
    { userId, email, publisherName }: LockedPublisher,
    reason: string,
  ): Promise<void> {
    try {
      await this.mailQueueService.enqueuePublisherStatusEmail(job, {
        userId,
        email,
        publisherName,
        reason,
      });
    } catch (error) {
      this.logger.error(error);
    }
  }
}
