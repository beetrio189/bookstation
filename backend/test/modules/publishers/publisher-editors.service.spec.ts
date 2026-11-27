import { DataSource } from 'typeorm';
import { RefreshToken } from '../../../src/modules/auth/entities/refresh-token.entity';
import { Provider } from '../../../src/modules/users/entities/provider.entity';
import { MailQueueService } from '../../../src/modules/mail/mail-queue.service';
import { SystemLog } from '../../../src/modules/system-logs/entities/system-log.entity';
import { User } from '../../../src/modules/users/entities/user.entity';
import { SystemActionType } from '../../../src/utils/enums/system-action-type.enum';
import { Editor } from '../../../src/modules/publishers/entities/editor.entity';
import { Publisher } from '../../../src/modules/publishers/entities/publisher.entity';
import { PublisherEditorsService } from '../../../src/modules/publishers/publisher-editors.service';
import { RoleCode } from '../../../src/utils/enums/role-code.enum';
import { currentLimits } from '../../../src/modules/subscriptions/current-limits';

jest.mock('../../../src/modules/subscriptions/current-limits', () => ({
  currentLimits: jest.fn(),
}));

describe('PublisherEditorsService', () => {
  const manager = { findOneBy: jest.fn() };
  const query = jest.fn();
  const tx = {
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    delete: jest.fn(),
    insert: jest.fn(),
    existsBy: jest.fn(),
    countBy: jest.fn(),
    create: jest.fn((_entity: unknown, data: object) => ({ ...data })),
    save: jest.fn(),
    update: jest.fn(),
    findOneByOrFail: jest.fn(),
  };
  const mailQueueService = {
    enqueueAccountDeletedEmail: jest.fn(),
    enqueueAccountCredentialsEmail: jest.fn(),
    enqueueAccountPasswordResetEmail: jest.fn(),
  };
  const service = new PublisherEditorsService(
    {
      manager,
      query,
      transaction: jest.fn((run: (m: typeof tx) => unknown) => run(tx)),
    } as unknown as DataSource,
    mailQueueService as unknown as MailQueueService,
  );

  const createdAt = new Date('2026-11-01T00:00:00.000Z');
  const ROWS = [
    {
      id: 'user-1',
      name: 'NXB Kim Đồng',
      email: 'kd@x.vn',
      role: RoleCode.PUBLISHER,
      hasPassword: true,
      createdAt,
    },
    {
      id: 'user-2',
      name: 'A',
      email: 'a@x.vn',
      role: RoleCode.EDITOR,
      hasPassword: false,
      createdAt,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue(ROWS);
  });

  it('lists the publisher and its editors with hasPassword for the owner', async () => {
    manager.findOneBy.mockResolvedValue({ id: 'publisher-1' });

    await expect(
      service.list({ id: 'user-1', role: RoleCode.PUBLISHER }),
    ).resolves.toEqual({ items: ROWS });

    expect(manager.findOneBy).toHaveBeenCalledWith(Publisher, {
      userId: 'user-1',
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('UNION ALL'), [
      'publisher-1',
      'local',
    ]);
  });

  it('hides hasPassword from an editor of the same publisher', async () => {
    manager.findOneBy.mockResolvedValue({ publisherId: 'publisher-1' });

    await service.list({ id: 'user-2', role: RoleCode.EDITOR });

    expect(manager.findOneBy).toHaveBeenCalledWith(Editor, {
      userId: 'user-2',
    });
    expect(query).toHaveBeenCalledWith(
      expect.not.stringContaining('hasPassword'),
      ['publisher-1', 'local'],
    );
  });

  it('returns 404 when the user has no publisher', async () => {
    manager.findOneBy.mockResolvedValue(null);

    await expect(
      service.list({ id: 'user-3', role: RoleCode.EDITOR }),
    ).rejects.toMatchObject({ code: 1003 });
    expect(query).not.toHaveBeenCalled();
  });

  describe('findOne', () => {
    const DETAIL = {
      id: 'user-2',
      name: 'A',
      email: 'a@x.vn',
      hasPassword: true,
      createdAt,
      updatedAt: createdAt,
    };

    it('finds the editor by users.id within the caller’s publisher', async () => {
      manager.findOneBy.mockResolvedValue({ id: 'publisher-1' });
      query.mockResolvedValue([DETAIL]);

      await expect(
        service.findOne({ id: 'user-1', role: RoleCode.PUBLISHER }, 'user-2'),
      ).resolves.toEqual(DETAIL);

      expect(manager.findOneBy).toHaveBeenCalledWith(Publisher, {
        userId: 'user-1',
      });
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('e.user_id = $1 AND e.publisher_id = $2'),
        ['user-2', 'publisher-1', 'local'],
      );
    });

    it('returns 404 for an editor of another publisher or the publisher itself', async () => {
      manager.findOneBy.mockResolvedValue({ id: 'publisher-1' });
      query.mockResolvedValue([]);

      await expect(
        service.findOne({ id: 'user-1', role: RoleCode.PUBLISHER }, 'user-1'),
      ).rejects.toMatchObject({ code: 1003 });
    });
  });

  describe('remove', () => {
    const OWNER = { id: 'user-1', role: RoleCode.PUBLISHER };

    beforeEach(() => {
      manager.findOneBy.mockResolvedValue({ id: 'publisher-1' });
      tx.findOne.mockResolvedValue({ id: 'editor-1', userId: 'user-2' });
      tx.findOneOrFail.mockImplementation((_entity, { where }) =>
        where.id === 'user-1'
          ? { name: 'NXB Kim Đồng' }
          : { id: 'user-2', name: 'A', notificationEmail: 'a@x.vn' },
      );
    });

    it('deletes the user, logs editors.id, then emails the editor', async () => {
      await expect(
        service.remove(OWNER, 'user-2', 'Nghỉ việc'),
      ).resolves.toEqual({});

      expect(tx.findOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          where: { userId: 'user-2', publisherId: 'publisher-1' },
          lock: { mode: 'pessimistic_write' },
        }),
      );
      expect(tx.delete).toHaveBeenCalledWith(User, { id: 'user-2' });
      expect(tx.insert).toHaveBeenCalledWith(SystemLog, {
        actorId: 'user-1',
        actorName: 'NXB Kim Đồng',
        actionType: SystemActionType.EDITOR_DELETION,
        targetId: 'editor-1',
        targetName: 'A',
        note: 'Nghỉ việc',
      });
      expect(mailQueueService.enqueueAccountDeletedEmail).toHaveBeenCalledWith(
        'user-2',
        'a@x.vn',
        'editor',
      );
    });

    it('returns 404 for an editor of another publisher and deletes nothing', async () => {
      tx.findOne.mockResolvedValue(null);

      await expect(service.remove(OWNER, 'user-9', '')).rejects.toMatchObject({
        code: 1003,
      });
      expect(tx.delete).not.toHaveBeenCalled();
      expect(
        mailQueueService.enqueueAccountDeletedEmail,
      ).not.toHaveBeenCalled();
    });

    it('still returns 200 when the mail job cannot be queued', async () => {
      mailQueueService.enqueueAccountDeletedEmail.mockRejectedValue(
        new Error('redis down'),
      );

      await expect(service.remove(OWNER, 'user-2', '')).resolves.toEqual({});
    });
  });

  describe('create', () => {
    const OWNER = { id: 'user-1', role: RoleCode.PUBLISHER };
    const BODY = { email: 'b@x.vn', name: 'B', note: '' };

    beforeEach(() => {
      manager.findOneBy.mockResolvedValue({ id: 'publisher-1' });
      tx.existsBy.mockResolvedValue(false);
      tx.countBy.mockResolvedValue(2);
      jest
        .mocked(currentLimits)
        .mockResolvedValue({ bookLimit: 100, editorLimit: 3 });
      tx.save.mockImplementation((entity: { role?: RoleCode }) =>
        entity.role
          ? { ...entity, id: 'user-5' }
          : { ...entity, id: 'editor-5', createdAt },
      );
      tx.findOneOrFail.mockResolvedValue({ name: 'NXB Kim Đồng' });
    });

    it('creates the user, local login and editors row, logs, then queues credentials', async () => {
      await expect(service.create(OWNER, BODY)).resolves.toEqual({
        id: 'user-5',
        email: 'b@x.vn',
        name: 'B',
        role: RoleCode.EDITOR,
        createdAt,
      });

      expect(tx.findOne).toHaveBeenCalledWith(Publisher, {
        where: { id: 'publisher-1' },
        lock: { mode: 'pessimistic_write' },
      });
      expect(tx.countBy).toHaveBeenCalledWith(Editor, {
        publisherId: 'publisher-1',
      });
      expect(tx.create).toHaveBeenCalledWith(Editor, {
        userId: 'user-5',
        publisherId: 'publisher-1',
      });
      expect(tx.insert).toHaveBeenCalledWith(
        Provider,
        expect.objectContaining({ providerKey: 'b@x.vn', passwordHash: null }),
      );
      expect(tx.insert).toHaveBeenCalledWith(
        SystemLog,
        expect.objectContaining({
          actionType: SystemActionType.EDITOR_CREATION,
          targetId: 'editor-5',
        }),
      );
      expect(
        mailQueueService.enqueueAccountCredentialsEmail,
      ).toHaveBeenCalledWith('user-5', 'b@x.vn', 'editor');
    });

    it('rejects when the publisher already has editor_limit editors', async () => {
      tx.countBy.mockResolvedValue(3);

      await expect(service.create(OWNER, BODY)).rejects.toMatchObject({
        code: 3009,
      });
      expect(tx.save).not.toHaveBeenCalled();
    });

    it('rejects an email that already has a password login', async () => {
      tx.existsBy.mockResolvedValue(true);

      await expect(service.create(OWNER, BODY)).rejects.toMatchObject({
        code: 2000,
      });
      expect(tx.save).not.toHaveBeenCalled();
    });

    it('still returns the editor when the mail job cannot be queued', async () => {
      mailQueueService.enqueueAccountCredentialsEmail.mockRejectedValueOnce(
        new Error('redis down'),
      );

      await expect(service.create(OWNER, BODY)).resolves.toMatchObject({
        id: 'user-5',
      });
    });
  });

  describe('resetPassword', () => {
    const OWNER = { id: 'user-1', role: RoleCode.PUBLISHER };

    beforeEach(() => {
      manager.findOneBy.mockResolvedValue({ id: 'publisher-1' });
      tx.findOne.mockResolvedValue({ id: 'editor-1', userId: 'user-2' });
      tx.findOneOrFail.mockImplementation((_entity, { where }) =>
        where.id === 'user-1'
          ? { name: 'NXB Kim Đồng' }
          : { id: 'user-2', name: 'A' },
      );
      tx.findOneByOrFail.mockResolvedValue({ providerKey: 'a@x.vn' });
    });

    it('clears the password, logs out, logs editors.id, then queues the new password', async () => {
      await expect(service.resetPassword(OWNER, 'user-2', '')).resolves.toEqual(
        {},
      );

      expect(tx.update).toHaveBeenCalledWith(
        Provider,
        { userId: 'user-2', provider: 'local' },
        { passwordHash: null },
      );
      expect(tx.delete).toHaveBeenCalledWith(RefreshToken, {
        userId: 'user-2',
      });
      expect(tx.insert).toHaveBeenCalledWith(
        SystemLog,
        expect.objectContaining({
          actionType: SystemActionType.EDITOR_PASSWORD_RESET,
          targetId: 'editor-1',
        }),
      );
      expect(
        mailQueueService.enqueueAccountPasswordResetEmail,
      ).toHaveBeenCalledWith('user-2', 'a@x.vn', 'editor');
    });

    it('returns 404 for an editor of another publisher', async () => {
      tx.findOne.mockResolvedValue(null);

      await expect(
        service.resetPassword(OWNER, 'user-9', ''),
      ).rejects.toMatchObject({ code: 1003 });
      expect(tx.update).not.toHaveBeenCalled();
    });

    it('returns 503 when the mail job cannot be queued', async () => {
      mailQueueService.enqueueAccountPasswordResetEmail.mockRejectedValueOnce(
        new Error('redis down'),
      );

      await expect(
        service.resetPassword(OWNER, 'user-2', ''),
      ).rejects.toMatchObject({ status: 503 });
    });
  });
});
