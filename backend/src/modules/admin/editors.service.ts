import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { EntityManager, Repository } from 'typeorm';
import { IdentityProvider } from '../../utils/enums/identity-provider.enum';
import { SystemActionType } from '../../utils/enums/system-action-type.enum';
import { UserStatus } from '../../utils/enums/user-status.enum';
import { AppException } from '../../utils/errors/app.exception';
import { ERRORS } from '../../utils/errors/errors';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { MailQueueService } from '../mail/mail-queue.service';
import { Editor } from '../publishers/entities/editor.entity';
import { Publisher } from '../publishers/entities/publisher.entity';
import { REDIS_CLIENT } from '../redis/redis.module';
import { Provider } from '../users/entities/provider.entity';
import { User } from '../users/entities/user.entity';
import { PasswordResetQuota } from './password-reset-quota';
import { writeSystemLog } from './write-system-log';

export interface EditorDetail {
  id: string;
  userId: string;
  publisherId: string;
  publisherName: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  status: UserStatus;
  hasPassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface LockedEditor {
  id: string;
  userId: string;
  name: string;
  email: string;
  status: UserStatus;
}

/**
 * Admin/KDV xử lý biên tập viên của NXB (vd. tài khoản NXB bị chiếm, kẻ xấu
 * tạo biên tập viên): xem, xóa hẳn, đặt lại mật khẩu. :id là editors.id.
 */
@Injectable()
export class EditorsService {
  private readonly logger = new Logger(EditorsService.name);
  private readonly resetQuota: PasswordResetQuota;

  constructor(
    @InjectRepository(Editor)
    private readonly editorsRepository: Repository<Editor>,
    private readonly mailQueueService: MailQueueService,
    @Inject(REDIS_CLIENT) redis: Redis,
  ) {
    this.resetQuota = new PasswordResetQuota(redis);
  }

  private get manager(): EntityManager {
    return this.editorsRepository.manager;
  }

  async findOne(id: string): Promise<EditorDetail> {
    const detail = await this.manager
      .createQueryBuilder(Editor, 'editor')
      .innerJoin(User, 'user', 'user.id = editor.user_id')
      .innerJoin(Publisher, 'publisher', 'publisher.id = editor.publisher_id')
      .leftJoin(
        Provider,
        'provider',
        'provider.user_id = user.id AND provider.provider = :local',
        { local: IdentityProvider.LOCAL },
      )
      .select('editor.id', 'id')
      .addSelect('user.id', 'userId')
      .addSelect('publisher.id', 'publisherId')
      .addSelect('publisher.publisher_name', 'publisherName')
      .addSelect('user.name', 'name')
      .addSelect('provider.provider_key', 'email')
      .addSelect('user.avatar_url', 'avatarUrl')
      .addSelect('user.bio', 'bio')
      .addSelect('user.status', 'status')
      .addSelect('provider.password_hash IS NOT NULL', 'hasPassword')
      .addSelect('editor.created_at', 'createdAt')
      .addSelect('GREATEST(user.updated_at, editor.updated_at)', 'updatedAt')
      .where('editor.id = :id', { id })
      .getRawOne<EditorDetail>();

    if (!detail) {
      throw new AppException(ERRORS.NOT_FOUND);
    }

    return detail;
  }

  async remove(
    actorId: string,
    id: string,
    note: string,
  ): Promise<Record<string, never>> {
    await this.manager.transaction(async (manager) => {
      const editor = await this.lockEditor(manager, id);

      await manager.delete(Editor, { id });
      await manager.delete(User, { id: editor.userId });

      await writeSystemLog(manager, actorId, {
        actionType: SystemActionType.EDITOR_DELETION,
        targetId: id,
        targetName: editor.name,
        note,
      });
    });

    return {};
  }

  // Như reset NXB: bị khóa (NXB bị đình chỉ) thì không reset, tối đa 3 lần/ngày
  async resetPassword(
    actorId: string,
    id: string,
    note: string,
  ): Promise<Record<string, never>> {
    await this.resetQuota.take(`editor:${id}`);

    let editor: LockedEditor;

    try {
      editor = await this.manager.transaction(async (manager) => {
        const target = await this.lockEditor(manager, id);

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
          actionType: SystemActionType.EDITOR_PASSWORD_RESET,
          targetId: id,
          targetName: target.name,
          note,
        });

        return target;
      });
    } catch (error) {
      await this.resetQuota.giveBack(`editor:${id}`);
      throw error;
    }

    try {
      await this.mailQueueService.enqueueAccountPasswordResetEmail(
        editor.userId,
        editor.email,
        'editor',
        note,
      );
    } catch (error) {
      this.logger.error(error);
      throw new AppException(ERRORS.SERVICE_UNAVAILABLE);
    }

    return {};
  }

  private async lockEditor(
    manager: EntityManager,
    id: string,
  ): Promise<LockedEditor> {
    const editor = await manager
      .createQueryBuilder(Editor, 'editor')
      .innerJoin(User, 'user', 'user.id = editor.user_id')
      .innerJoin(
        Provider,
        'provider',
        'provider.user_id = user.id AND provider.provider = :local',
        { local: IdentityProvider.LOCAL },
      )
      .select('editor.id', 'id')
      .addSelect('user.id', 'userId')
      .addSelect('user.name', 'name')
      .addSelect('provider.provider_key', 'email')
      .addSelect('user.status', 'status')
      .where('editor.id = :id', { id })
      .setLock('pessimistic_write')
      .getRawOne<LockedEditor>();

    if (!editor) {
      throw new AppException(ERRORS.NOT_FOUND);
    }

    return editor;
  }
}
