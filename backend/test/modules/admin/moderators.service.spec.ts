import { Logger } from '@nestjs/common';
import { EntityNotFoundError, QueryFailedError, Repository } from 'typeorm';
import { ModeratorsService } from '../../../src/modules/admin/moderators.service';
import { RefreshToken } from '../../../src/modules/auth/entities/refresh-token.entity';
import { MailQueueService } from '../../../src/modules/mail/mail-queue.service';
import { SystemLog } from '../../../src/modules/system-logs/entities/system-log.entity';
import { Provider } from '../../../src/modules/users/entities/provider.entity';
import { User } from '../../../src/modules/users/entities/user.entity';
import { IdentityProvider } from '../../../src/utils/enums/identity-provider.enum';
import { RoleCode } from '../../../src/utils/enums/role-code.enum';
import { SystemActionType } from '../../../src/utils/enums/system-action-type.enum';

const ADMIN_ID = 'admin-1';
const DTO = {
  email: 'kdv@bookstation.vn',
  name: 'Kiểm duyệt viên A',
  note: 'Tuyển thêm người',
};
const CREATED_AT = new Date('2026-11-16T03:00:00.000Z');

describe('ModeratorsService', () => {
  // Query builder giả: mọi hàm nối chuỗi trả lại chính nó
  const queryBuilder = {
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
  } as Record<string, jest.Mock>;
  for (const method of [
    'leftJoin',
    'innerJoin',
    'select',
    'addSelect',
    'where',
    'orderBy',
    'setLock',
  ]) {
    queryBuilder[method] = jest.fn(() => queryBuilder);
  }

  const manager = {
    existsBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    insert: jest.fn(),
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
    transaction: jest.fn(),
  };
  manager.transaction.mockImplementation(
    (work: (m: typeof manager) => unknown) => work(manager),
  );
  const usersRepository = {
    manager,
    createQueryBuilder: jest.fn(() => queryBuilder),
  };
  const mailQueueService = {
    enqueueAccountCredentialsEmail: jest.fn(),
    enqueueAccountPasswordResetEmail: jest.fn(),
    enqueueAccountDeletedEmail: jest.fn(),
  };
  const service = new ModeratorsService(
    usersRepository as unknown as Repository<User>,
    mailQueueService as unknown as MailQueueService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    mailQueueService.enqueueAccountPasswordResetEmail.mockResolvedValue(
      undefined,
    );
    mailQueueService.enqueueAccountCredentialsEmail.mockResolvedValue(
      undefined,
    );
    manager.existsBy.mockResolvedValue(false);
    manager.findOneOrFail.mockResolvedValue({ name: 'Quản trị viên' });
    manager.create.mockImplementation((_entity, data: object) => data);
    manager.save.mockImplementation((data: object) => ({
      ...data,
      id: 'moderator-1',
      status: 'active',
      createdAt: CREATED_AT,
    }));
  });

  it('creates a moderator without a password, logs it, then queues the email', async () => {
    await expect(service.create(ADMIN_ID, DTO)).resolves.toEqual({
      id: 'moderator-1',
      email: DTO.email,
      name: DTO.name,
      role: RoleCode.MODERATOR,
      status: 'active',
      createdAt: CREATED_AT,
    });

    expect(manager.create).toHaveBeenCalledWith(User, {
      role: RoleCode.MODERATOR,
      name: DTO.name,
      notificationEmail: DTO.email,
      notificationEmailVerified: true,
    });
    expect(manager.insert).toHaveBeenCalledWith(Provider, {
      userId: 'moderator-1',
      provider: IdentityProvider.LOCAL,
      providerKey: DTO.email,
      verified: true,
      passwordHash: null,
    });
    expect(manager.findOneOrFail).toHaveBeenCalledWith(User, {
      select: { name: true },
      where: { id: ADMIN_ID },
    });
    expect(manager.insert).toHaveBeenCalledWith(SystemLog, {
      actorId: ADMIN_ID,
      actorName: 'Quản trị viên',
      actionType: SystemActionType.MODERATOR_CREATION,
      targetId: 'moderator-1',
      targetName: DTO.name,
      note: DTO.note,
    });
    expect(
      mailQueueService.enqueueAccountCredentialsEmail,
    ).toHaveBeenCalledWith('moderator-1', DTO.email, 'moderator');
  });

  it('rejects an email that already has a password login', async () => {
    manager.existsBy.mockResolvedValue(true);

    await expect(service.create(ADMIN_ID, DTO)).rejects.toMatchObject({
      code: 2000,
    });

    expect(manager.existsBy).toHaveBeenCalledWith(Provider, {
      provider: IdentityProvider.LOCAL,
      providerKey: DTO.email,
    });
    expect(manager.save).not.toHaveBeenCalled();
    expect(
      mailQueueService.enqueueAccountCredentialsEmail,
    ).not.toHaveBeenCalled();
  });

  it('rejects when a concurrent request takes the email first', async () => {
    manager.insert.mockRejectedValueOnce(
      new QueryFailedError('INSERT', [], {
        code: '23505',
      } as unknown as Error),
    );

    await expect(service.create(ADMIN_ID, DTO)).rejects.toMatchObject({
      code: 2000,
    });
    expect(
      mailQueueService.enqueueAccountCredentialsEmail,
    ).not.toHaveBeenCalled();
  });

  it('creates nothing when the admin account cannot be read', async () => {
    const failure = new EntityNotFoundError(User, {});
    manager.findOneOrFail.mockRejectedValueOnce(failure);

    await expect(service.create(ADMIN_ID, DTO)).rejects.toBe(failure);
    expect(manager.insert).not.toHaveBeenCalledWith(
      SystemLog,
      expect.anything(),
    );
    expect(
      mailQueueService.enqueueAccountCredentialsEmail,
    ).not.toHaveBeenCalled();
  });

  it('does not hide other database errors', async () => {
    const failure = new Error('connection lost');
    manager.insert.mockRejectedValueOnce(failure);

    await expect(service.create(ADMIN_ID, DTO)).rejects.toBe(failure);
  });

  it('still returns the new account when the email cannot be queued', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    mailQueueService.enqueueAccountCredentialsEmail.mockRejectedValue(
      new Error('Redis down'),
    );

    await expect(service.create(ADMIN_ID, DTO)).resolves.toMatchObject({
      id: 'moderator-1',
    });
    expect(error).toHaveBeenCalled();
  });

  describe('list', () => {
    const ROWS = [
      {
        id: 'moderator-1',
        email: 'kdv@bookstation.vn',
        name: 'KDV A',
        role: RoleCode.MODERATOR,
        hasPassword: false,
      },
      {
        id: 'admin-1',
        email: 'admin@bookstation.vn',
        name: 'Admin',
        role: RoleCode.ADMIN,
        hasPassword: true,
      },
    ];

    beforeEach(() => queryBuilder.getRawMany.mockResolvedValue(ROWS));

    it('lists admins and moderators, newest first, with hasPassword for an admin', async () => {
      await expect(service.list(RoleCode.ADMIN)).resolves.toEqual({
        items: ROWS,
      });

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'user.role IN (:...roles)',
        { roles: [RoleCode.ADMIN, RoleCode.MODERATOR] },
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'user.created_at',
        'DESC',
      );
    });

    it('hides hasPassword from a moderator', async () => {
      const { items } = await service.list(RoleCode.MODERATOR);

      expect(items).toEqual(
        ROWS.map(({ id, email, name, role }) => ({ id, email, name, role })),
      );
      expect(items[0]).not.toHaveProperty('hasPassword');
    });
  });

  describe('findOne', () => {
    it('returns the detail of a moderator or an admin', async () => {
      const detail = { id: 'moderator-1', name: 'KDV A', hasPassword: true };
      queryBuilder.getRawOne.mockResolvedValue(detail);

      await expect(service.findOne('moderator-1')).resolves.toBe(detail);
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'user.id = :id AND user.role IN (:...roles)',
        { id: 'moderator-1', roles: [RoleCode.ADMIN, RoleCode.MODERATOR] },
      );
      expect(queryBuilder.addSelect).toHaveBeenCalledWith('user.role', 'role');
      expect(queryBuilder.setLock).not.toHaveBeenCalled();
    });

    it('returns 404 for a missing id or an account of another role', async () => {
      queryBuilder.getRawOne.mockResolvedValue(undefined);

      await expect(service.findOne('reader-1')).rejects.toMatchObject({
        code: 1003,
      });
    });
  });

  describe('remove', () => {
    it('deletes the moderator and logs the deletion with names', async () => {
      manager.findOne.mockResolvedValueOnce({
        id: 'moderator-1',
        name: 'KDV A',
        notificationEmail: 'kdv@example.com',
      });

      await expect(
        service.remove(ADMIN_ID, 'moderator-1', 'Nghỉ việc'),
      ).resolves.toEqual({});

      expect(manager.findOne).toHaveBeenNthCalledWith(1, User, {
        select: { id: true, name: true, notificationEmail: true },
        where: { id: 'moderator-1', role: RoleCode.MODERATOR },
        lock: { mode: 'pessimistic_write' },
      });
      expect(manager.delete).toHaveBeenCalledWith(User, { id: 'moderator-1' });
      expect(manager.insert).toHaveBeenCalledWith(SystemLog, {
        actorId: ADMIN_ID,
        actorName: 'Quản trị viên',
        actionType: SystemActionType.MODERATOR_DELETION,
        targetId: 'moderator-1',
        targetName: 'KDV A',
        note: 'Nghỉ việc',
      });
      expect(mailQueueService.enqueueAccountDeletedEmail).toHaveBeenCalledWith(
        'moderator-1',
        'kdv@example.com',
        'moderator',
      );
    });

    it('still succeeds when the email job cannot be queued', async () => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation();
      manager.findOne.mockResolvedValueOnce({
        id: 'moderator-1',
        name: 'KDV A',
        notificationEmail: 'kdv@example.com',
      });
      mailQueueService.enqueueAccountDeletedEmail.mockRejectedValueOnce(
        new Error('Redis down'),
      );

      await expect(
        service.remove(ADMIN_ID, 'moderator-1', 'x'),
      ).resolves.toEqual({});
    });

    it('returns 404 when there is no such moderator (or it was just deleted)', async () => {
      manager.findOne.mockResolvedValueOnce(null);

      await expect(
        service.remove(ADMIN_ID, 'moderator-1', 'Nghỉ việc'),
      ).rejects.toMatchObject({ code: 1003 });
      expect(manager.delete).not.toHaveBeenCalled();
      expect(manager.insert).not.toHaveBeenCalled();
      expect(
        mailQueueService.enqueueAccountDeletedEmail,
      ).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    beforeEach(() => {
      queryBuilder.getRawOne.mockResolvedValue({
        id: 'moderator-1',
        email: 'kdv@bookstation.vn',
        name: 'KDV A',
      });
    });

    it('clears the password, logs out every device, logs it, then queues the email', async () => {
      await expect(
        service.resetPassword(ADMIN_ID, 'moderator-1', ''),
      ).resolves.toEqual({});

      // Chỉ reset KDV, không reset admin
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'user.id = :id AND user.role IN (:...roles)',
        { id: 'moderator-1', roles: [RoleCode.MODERATOR] },
      );
      expect(queryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(manager.update).toHaveBeenCalledWith(
        Provider,
        { userId: 'moderator-1', provider: IdentityProvider.LOCAL },
        { passwordHash: null },
      );
      expect(manager.delete).toHaveBeenCalledWith(RefreshToken, {
        userId: 'moderator-1',
      });
      expect(manager.insert).toHaveBeenCalledWith(SystemLog, {
        actorId: ADMIN_ID,
        actorName: 'Quản trị viên',
        actionType: SystemActionType.MODERATOR_PASSWORD_RESET,
        targetId: 'moderator-1',
        targetName: 'KDV A',
        note: '',
      });
      expect(
        mailQueueService.enqueueAccountPasswordResetEmail,
      ).toHaveBeenCalledWith('moderator-1', 'kdv@bookstation.vn', 'moderator');
    });

    it('returns 404 when there is no such moderator', async () => {
      queryBuilder.getRawOne.mockResolvedValue(undefined);

      await expect(
        service.resetPassword(ADMIN_ID, 'moderator-1', ''),
      ).rejects.toMatchObject({ code: 1003 });
      expect(manager.update).not.toHaveBeenCalled();
      expect(
        mailQueueService.enqueueAccountPasswordResetEmail,
      ).not.toHaveBeenCalled();
    });

    it('returns 503 when the email cannot be queued, so the admin can retry', async () => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation();
      mailQueueService.enqueueAccountPasswordResetEmail.mockRejectedValue(
        new Error('Redis down'),
      );

      await expect(
        service.resetPassword(ADMIN_ID, 'moderator-1', ''),
      ).rejects.toMatchObject({ code: 1006 });
    });
  });
});
