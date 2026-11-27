import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { isUniqueViolation } from '../../utils/database-errors';
import { IdentityProvider } from '../../utils/enums/identity-provider.enum';
import { RoleCode } from '../../utils/enums/role-code.enum';
import { SystemActionType } from '../../utils/enums/system-action-type.enum';
import { AppException } from '../../utils/errors/app.exception';
import { ERRORS } from '../../utils/errors/errors';
import type { AuthUser } from '../../utils/types/auth-user';
import { writeSystemLog } from '../admin/write-system-log';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { MailQueueService } from '../mail/mail-queue.service';
import { Provider } from '../users/entities/provider.entity';
import { currentLimits } from '../subscriptions/current-limits';
import { User } from '../users/entities/user.entity';
import { CreateEditorDto } from './dto/create-editor.dto';
import { Editor } from './entities/editor.entity';
import { Publisher } from './entities/publisher.entity';
import { findPublisherId } from './find-publisher-id';

export interface MemberItem {
  id: string;
  name: string;
  email: string;
  role: RoleCode.PUBLISHER | RoleCode.EDITOR;
  hasPassword?: boolean;
  createdAt: Date;
}

export interface EditorDetail {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  hasPassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EditorCreated {
  id: string;
  email: string;
  name: string;
  role: RoleCode.EDITOR;
  createdAt: Date;
}

@Injectable()
export class PublisherEditorsService {
  private readonly logger = new Logger(PublisherEditorsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly mailQueueService: MailQueueService,
  ) {}

  /**
   * Thành viên NXB mà user là chủ hoặc biên tập viên: NXB trước (tên = publisher_name),
   * rồi biên tập viên mới tạo trước. Biên tập viên gọi thì bỏ hasPassword.
   */
  async list(user: AuthUser): Promise<{ items: MemberItem[] }> {
    const isOwner = user.role === RoleCode.PUBLISHER;
    const publisherId = await findPublisherId(
      this.dataSource.manager,
      user.id,
      isOwner,
    );

    const items = await this.dataSource.query<MemberItem[]>(
      `SELECT m.user_id AS id, m.name, pr.provider_key AS email, u.role,
              ${isOwner ? 'pr.password_hash IS NOT NULL AS "hasPassword",' : ''}
              m.created_at AS "createdAt"
       FROM (
         SELECT p.user_id, p.publisher_name AS name, p.created_at, 0 AS ord
         FROM publishers p WHERE p.id = $1
         UNION ALL
         SELECT e.user_id, u.name, e.created_at, 1
         FROM editors e JOIN users u ON u.id = e.user_id
         WHERE e.publisher_id = $1
       ) m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN providers pr ON pr.user_id = u.id AND pr.provider = $2
       ORDER BY m.ord, m.created_at DESC, m.user_id DESC`,
      [publisherId, IdentityProvider.LOCAL],
    );

    return { items };
  }

  /** Chi tiết một biên tập viên (:id = users.id) của NXB đang gọi; NXB khác / chính NXB → 404 */
  async findOne(user: AuthUser, id: string): Promise<EditorDetail> {
    const publisherId = await findPublisherId(
      this.dataSource.manager,
      user.id,
      true,
    );

    const [detail] = await this.dataSource.query<EditorDetail[]>(
      `SELECT u.id, u.name, pr.provider_key AS email,
              u.avatar_url AS "avatarUrl", u.bio,
              pr.password_hash IS NOT NULL AS "hasPassword",
              e.created_at AS "createdAt",
              GREATEST(u.updated_at, e.updated_at) AS "updatedAt"
       FROM editors e
       JOIN users u ON u.id = e.user_id
       LEFT JOIN providers pr ON pr.user_id = u.id AND pr.provider = $3
       WHERE e.user_id = $1 AND e.publisher_id = $2`,
      [id, publisherId, IdentityProvider.LOCAL],
    );

    if (!detail) {
      throw new AppException(ERRORS.NOT_FOUND);
    }

    return detail;
  }

  /**
   * Như admin tạo KDV: user (role editor) + đăng nhập local chưa có mật khẩu + editors
   * + log trong một transaction, rồi đẩy job để worker sinh mật khẩu và gửi mail
   * (đẩy lỗi chỉ log, vẫn 201).
   */
  async create(
    user: AuthUser,
    { email, name, note }: CreateEditorDto,
  ): Promise<EditorCreated> {
    const publisherId = await findPublisherId(
      this.dataSource.manager,
      user.id,
      true,
    );
    let created: { account: User; editor: Editor };

    try {
      created = await this.dataSource.transaction(async (manager) => {
        await manager.findOne(Publisher, {
          where: { id: publisherId },
          lock: { mode: 'pessimistic_write' },
        });

        const { editorLimit } = await currentLimits(manager, publisherId);
        const count = await manager.countBy(Editor, { publisherId });

        if (count >= editorLimit) {
          throw new AppException(ERRORS.EDITOR_LIMIT_REACHED);
        }

        if (
          await manager.existsBy(Provider, {
            provider: IdentityProvider.LOCAL,
            providerKey: email,
          })
        ) {
          throw new AppException(ERRORS.EMAIL_ALREADY_EXISTS);
        }

        const account = await manager.save(
          manager.create(User, {
            role: RoleCode.EDITOR,
            name,
            notificationEmail: email,
            notificationEmailVerified: true,
          }),
        );

        await manager.insert(Provider, {
          userId: account.id,
          provider: IdentityProvider.LOCAL,
          providerKey: email,
          verified: true,
          passwordHash: null,
        });

        const editor = await manager.save(
          manager.create(Editor, { userId: account.id, publisherId }),
        );

        await writeSystemLog(manager, user.id, {
          actionType: SystemActionType.EDITOR_CREATION,
          targetId: editor.id,
          targetName: account.name,
          note,
        });

        return { account, editor };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppException(ERRORS.EMAIL_ALREADY_EXISTS);
      }

      throw error;
    }

    try {
      await this.mailQueueService.enqueueAccountCredentialsEmail(
        created.account.id,
        email,
        'editor',
      );
    } catch (error) {
      this.logger.error(error);
    }

    return {
      id: created.account.id,
      email,
      name: created.account.name,
      role: RoleCode.EDITOR,
      createdAt: created.editor.createdAt,
    };
  }

  /**
   * Như admin xóa KDV: xóa hẳn user (editors, providers, refresh_tokens CASCADE),
   * log editor_deletion (target_id = editors.id), sau commit báo mail cho biên tập viên.
   */
  async remove(
    user: AuthUser,
    id: string,
    note: string,
  ): Promise<Record<string, never>> {
    const publisherId = await findPublisherId(
      this.dataSource.manager,
      user.id,
      true,
    );

    const target = await this.dataSource.transaction(async (manager) => {
      const { editor, account } = await this.lockEditor(
        manager,
        id,
        publisherId,
      );

      await manager.delete(User, { id });

      await writeSystemLog(manager, user.id, {
        actionType: SystemActionType.EDITOR_DELETION,
        targetId: editor.id,
        targetName: account.name,
        note,
      });

      return account;
    });

    try {
      await this.mailQueueService.enqueueAccountDeletedEmail(
        id,
        target.notificationEmail,
        'editor',
      );
    } catch (error) {
      this.logger.error(error);
    }

    return {};
  }

  /**
   * Như admin reset KDV (không giới hạn số lần): xóa mật khẩu, đăng xuất mọi thiết bị,
   * log; sau commit worker sinh mật khẩu mới và gửi mail, đẩy job lỗi → 503.
   */
  async resetPassword(
    user: AuthUser,
    id: string,
    note: string,
  ): Promise<Record<string, never>> {
    const publisherId = await findPublisherId(
      this.dataSource.manager,
      user.id,
      true,
    );

    const email = await this.dataSource.transaction(async (manager) => {
      const { editor, account } = await this.lockEditor(
        manager,
        id,
        publisherId,
      );
      const login = { userId: id, provider: IdentityProvider.LOCAL };
      const { providerKey } = await manager.findOneByOrFail(Provider, login);

      await manager.update(Provider, login, { passwordHash: null });
      await manager.delete(RefreshToken, { userId: id });

      await writeSystemLog(manager, user.id, {
        actionType: SystemActionType.EDITOR_PASSWORD_RESET,
        targetId: editor.id,
        targetName: account.name,
        note,
      });

      return providerKey;
    });

    try {
      await this.mailQueueService.enqueueAccountPasswordResetEmail(
        id,
        email,
        'editor',
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
    publisherId: string,
  ): Promise<{ editor: Editor; account: User }> {
    const editor = await manager.findOne(Editor, {
      where: { userId: id, publisherId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!editor) {
      throw new AppException(ERRORS.NOT_FOUND);
    }

    const account = await manager.findOneOrFail(User, {
      select: { id: true, name: true, notificationEmail: true },
      where: { id },
    });

    return { editor, account };
  }
}
