import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { EditorsService } from '../../../src/modules/admin/editors.service';
import { RefreshToken } from '../../../src/modules/auth/entities/refresh-token.entity';
import { MailQueueService } from '../../../src/modules/mail/mail-queue.service';
import { Editor } from '../../../src/modules/publishers/entities/editor.entity';
import { SystemLog } from '../../../src/modules/system-logs/entities/system-log.entity';
import { Provider } from '../../../src/modules/users/entities/provider.entity';
import { User } from '../../../src/modules/users/entities/user.entity';
import { IdentityProvider } from '../../../src/utils/enums/identity-provider.enum';
import { SystemActionType } from '../../../src/utils/enums/system-action-type.enum';
import { UserStatus } from '../../../src/utils/enums/user-status.enum';

const ACTOR_ID = 'moderator-1';
const TARGET = {
  id: 'editor-1',
  userId: 'user-9',
  name: 'Biên tập A',
  email: 'bt@example.com',
  status: UserStatus.ACTIVE,
};

describe('EditorsService', () => {
  const queryBuilder = { getRawOne: jest.fn() } as Record<string, jest.Mock>;
  for (const method of [
    'leftJoin',
    'innerJoin',
    'select',
    'addSelect',
    'where',
    'setLock',
  ]) {
    queryBuilder[method] = jest.fn(() => queryBuilder);
  }

  const manager = {
    insert: jest.fn(),
    findOneOrFail: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
    transaction: jest.fn(),
  };
  manager.transaction.mockImplementation(
    (work: (m: typeof manager) => unknown) => work(manager),
  );
  const mailQueueService = { enqueueAccountPasswordResetEmail: jest.fn() };
  const redis = { incr: jest.fn(), expire: jest.fn(), decr: jest.fn() };
  const service = new EditorsService(
    { manager } as unknown as Repository<Editor>,
    mailQueueService as unknown as MailQueueService,
    redis as unknown as Redis,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    manager.findOneOrFail.mockResolvedValue({ name: 'KDV B' });
    queryBuilder.getRawOne.mockResolvedValue({ ...TARGET });
    redis.incr.mockResolvedValue(1);
    mailQueueService.enqueueAccountPasswordResetEmail.mockResolvedValue(
      undefined,
    );
  });

  it('returns 404 for an unknown editor', async () => {
    queryBuilder.getRawOne.mockResolvedValue(undefined);

    await expect(service.findOne('editor-x')).rejects.toMatchObject({
      code: 1003,
    });
  });

  describe('remove', () => {
    it('deletes the editor row and the account, logs on editors.id with the note', async () => {
      await expect(
        service.remove(ACTOR_ID, 'editor-1', 'Do kẻ xấu tạo'),
      ).resolves.toEqual({});

      expect(queryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(manager.delete).toHaveBeenNthCalledWith(1, Editor, {
        id: 'editor-1',
      });
      expect(manager.delete).toHaveBeenNthCalledWith(2, User, {
        id: 'user-9',
      });
      expect(manager.insert).toHaveBeenCalledWith(SystemLog, {
        actorId: ACTOR_ID,
        actorName: 'KDV B',
        actionType: SystemActionType.EDITOR_DELETION,
        targetId: 'editor-1',
        targetName: 'Biên tập A',
        note: 'Do kẻ xấu tạo',
      });
    });

    it('returns 404 when the editor is gone', async () => {
      queryBuilder.getRawOne.mockResolvedValue(undefined);

      await expect(
        service.remove(ACTOR_ID, 'editor-1', 'x'),
      ).rejects.toMatchObject({ code: 1003 });
      expect(manager.delete).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('clears the password, logs out, logs, and emails the reason', async () => {
      await expect(
        service.resetPassword(ACTOR_ID, 'editor-1', 'NXB nhờ'),
      ).resolves.toEqual({});

      expect(redis.incr).toHaveBeenCalledWith(
        'admin:password-reset-quota:editor:editor-1',
      );
      expect(manager.update).toHaveBeenCalledWith(
        Provider,
        { userId: 'user-9', provider: IdentityProvider.LOCAL },
        { passwordHash: null },
      );
      expect(manager.delete).toHaveBeenCalledWith(RefreshToken, {
        userId: 'user-9',
      });
      expect(manager.insert).toHaveBeenCalledWith(
        SystemLog,
        expect.objectContaining({
          actionType: SystemActionType.EDITOR_PASSWORD_RESET,
          targetId: 'editor-1',
          note: 'NXB nhờ',
        }),
      );
      expect(
        mailQueueService.enqueueAccountPasswordResetEmail,
      ).toHaveBeenCalledWith('user-9', 'bt@example.com', 'editor', 'NXB nhờ');
    });

    it('refuses a locked editor (publisher suspended) and gives the turn back', async () => {
      queryBuilder.getRawOne.mockResolvedValue({
        ...TARGET,
        status: UserStatus.LOCKED,
      });

      await expect(
        service.resetPassword(ACTOR_ID, 'editor-1', 'x'),
      ).rejects.toMatchObject({ code: 3002 });
      expect(manager.update).not.toHaveBeenCalled();
      expect(redis.decr).toHaveBeenCalled();
    });
  });
});
