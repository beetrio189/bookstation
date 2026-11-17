import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { isUniqueViolation } from '../../utils/database-errors';
import { IdentityProvider } from '../../utils/enums/identity-provider.enum';
import { RoleCode } from '../../utils/enums/role-code.enum';
import { SystemActionType } from '../../utils/enums/system-action-type.enum';
import { UserStatus } from '../../utils/enums/user-status.enum';
import { AppException } from '../../utils/errors/app.exception';
import { ERRORS } from '../../utils/errors/errors';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { MailQueueService } from '../mail/mail-queue.service';
import { Provider } from '../users/entities/provider.entity';
import { User } from '../users/entities/user.entity';
import { CreateModeratorDto } from './dto/create-moderator.dto';
import { writeSystemLog } from './write-system-log';

export interface ModeratorView {
  id: string;
  email: string;
  name: string;
  role: RoleCode;
  status: UserStatus;
  createdAt: Date;
}

export interface ModeratorListItem {
  id: string;
  email: string;
  name: string;
  role: RoleCode;
  hasPassword?: boolean;
}

export interface ModeratorDetail {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  role: RoleCode;
  hasPassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BACK_OFFICE_ROLES = [RoleCode.ADMIN, RoleCode.MODERATOR];

@Injectable()
export class ModeratorsService {
  private readonly logger = new Logger(ModeratorsService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly mailQueueService: MailQueueService,
  ) {}

  /**
   * Tạo tài khoản KDV chưa có mật khẩu (user + đăng nhập local + log) trong một
   * transaction, rồi đẩy job để worker sinh mật khẩu và gửi email.
   */
  async create(
    actorId: string,
    { email, name, note }: CreateModeratorDto,
  ): Promise<ModeratorView> {
    let user: User;

    try {
      user = await this.usersRepository.manager.transaction(async (manager) => {
        if (
          await manager.existsBy(Provider, {
            provider: IdentityProvider.LOCAL,
            providerKey: email,
          })
        ) {
          throw new AppException(ERRORS.EMAIL_ALREADY_EXISTS);
        }

        const created = await manager.save(
          manager.create(User, {
            role: RoleCode.MODERATOR,
            name,
            notificationEmail: email,
            notificationEmailVerified: true,
          }),
        );

        await manager.insert(Provider, {
          userId: created.id,
          provider: IdentityProvider.LOCAL,
          providerKey: email,
          verified: true,
          passwordHash: null,
        });

        await writeSystemLog(manager, actorId, {
          actionType: SystemActionType.MODERATOR_CREATION,
          targetId: created.id,
          targetName: created.name,
          note,
        });

        return created;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppException(ERRORS.EMAIL_ALREADY_EXISTS);
      }

      throw error;
    }

    await this.enqueueCredentialsEmail(user.id, email);

    return {
      id: user.id,
      email,
      name: user.name,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    };
  }

  async list(viewerRole: RoleCode): Promise<{ items: ModeratorListItem[] }> {
    const rows = await this.usersRepository
      .createQueryBuilder('user')
      .leftJoin(
        Provider,
        'provider',
        'provider.user_id = user.id AND provider.provider = :local',
        { local: IdentityProvider.LOCAL },
      )
      .select('user.id', 'id')
      .addSelect('provider.provider_key', 'email')
      .addSelect('user.name', 'name')
      .addSelect('user.role', 'role')
      .addSelect('provider.password_hash IS NOT NULL', 'hasPassword')
      .where('user.role IN (:...roles)', { roles: BACK_OFFICE_ROLES })
      .orderBy('user.created_at', 'DESC')
      .getRawMany<Required<ModeratorListItem>>();

    const isAdmin = viewerRole === RoleCode.ADMIN;

    return {
      items: rows.map(({ hasPassword, ...item }) =>
        isAdmin ? { ...item, hasPassword } : item,
      ),
    };
  }

  async findOne(id: string): Promise<ModeratorDetail> {
    // Xem được cả admin (danh sách có admin); xóa/reset vẫn chỉ KDV, FE ẩn nút ở dòng admin
    const account = await this.findAccount(
      this.usersRepository.manager,
      id,
      BACK_OFFICE_ROLES,
    );

    if (!account) {
      throw new AppException(ERRORS.NOT_FOUND);
    }

    return account;
  }

  async remove(
    actorId: string,
    id: string,
    note: string,
  ): Promise<Record<string, never>> {
    const moderator = await this.usersRepository.manager.transaction(
      async (manager) => {
      const moderator = await manager.findOne(User, {
        select: { id: true, name: true, notificationEmail: true },
        where: { id, role: RoleCode.MODERATOR },
        lock: { mode: 'pessimistic_write' },
      });

      if (!moderator) {
        throw new AppException(ERRORS.NOT_FOUND);
      }

      await manager.delete(User, { id });

      await writeSystemLog(manager, actorId, {
        actionType: SystemActionType.MODERATOR_DELETION,
        targetId: id,
        targetName: moderator.name,
        note,
      });

      return moderator;
      },
    );

    // Đã xóa xong: không đẩy được mail thì chỉ ghi log, không báo lỗi cho admin
    try {
      await this.mailQueueService.enqueueAccountDeletedEmail(
        id,
        moderator.notificationEmail,
        'moderator',
      );
    } catch (error) {
      this.logger.error(error);
    }

    return {};
  }

  /**
   * Mật khẩu cũ hết hiệu lực ngay, mọi thiết bị bị đăng xuất; worker sinh mật
   * khẩu mới và gửi mail. Đẩy job lỗi thì báo 503 để admin bấm lại.
   */
  async resetPassword(
    actorId: string,
    id: string,
    note: string,
  ): Promise<Record<string, never>> {
    const email = await this.usersRepository.manager.transaction(
      async (manager) => {
        const moderator = await this.findAccount(
          manager,
          id,
          [RoleCode.MODERATOR],
          true,
        );

        if (!moderator) {
          throw new AppException(ERRORS.NOT_FOUND);
        }

        await manager.update(
          Provider,
          { userId: id, provider: IdentityProvider.LOCAL },
          { passwordHash: null },
        );
        await manager.delete(RefreshToken, { userId: id });

        await writeSystemLog(manager, actorId, {
          actionType: SystemActionType.MODERATOR_PASSWORD_RESET,
          targetId: id,
          targetName: moderator.name,
          note,
        });

        return moderator.email;
      },
    );

    try {
      await this.mailQueueService.enqueueAccountPasswordResetEmail(
        id,
        email,
        'moderator',
      );
    } catch (error) {
      this.logger.error(error);
      throw new AppException(ERRORS.SERVICE_UNAVAILABLE);
    }

    return {};
  }

  private async findAccount(
    manager: EntityManager,
    id: string,
    roles: RoleCode[],
    lock = false,
  ): Promise<ModeratorDetail | undefined> {
    const query = manager
      .createQueryBuilder(User, 'user')
      .innerJoin(
        Provider,
        'provider',
        'provider.user_id = user.id AND provider.provider = :local',
        { local: IdentityProvider.LOCAL },
      )
      .select('user.id', 'id')
      .addSelect('provider.provider_key', 'email')
      .addSelect('user.name', 'name')
      .addSelect('user.role', 'role')
      .addSelect('user.avatar_url', 'avatarUrl')
      .addSelect('user.bio', 'bio')
      .addSelect('provider.password_hash IS NOT NULL', 'hasPassword')
      .addSelect('user.created_at', 'createdAt')
      .addSelect('user.updated_at', 'updatedAt')
      .where('user.id = :id AND user.role IN (:...roles)', { id, roles });

    if (lock) {
      query.setLock('pessimistic_write');
    }

    return query.getRawOne<ModeratorDetail>();
  }

  private async enqueueCredentialsEmail(
    userId: string,
    email: string,
  ): Promise<void> {
    try {
      await this.mailQueueService.enqueueAccountCredentialsEmail(
        userId,
        email,
        'moderator',
      );
    } catch (error) {
      this.logger.error(error);
    }
  }
}
