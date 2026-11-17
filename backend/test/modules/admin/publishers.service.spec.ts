import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { In, QueryFailedError, Repository } from 'typeorm';
import { PublishersService } from '../../../src/modules/admin/publishers.service';
import { RefreshToken } from '../../../src/modules/auth/entities/refresh-token.entity';
import { MailJob } from '../../../src/modules/mail/mail-queue.constants';
import { MailQueueService } from '../../../src/modules/mail/mail-queue.service';
import { Publisher } from '../../../src/modules/publishers/entities/publisher.entity';
import { SystemLog } from '../../../src/modules/system-logs/entities/system-log.entity';
import { Provider } from '../../../src/modules/users/entities/provider.entity';
import { User } from '../../../src/modules/users/entities/user.entity';
import { IdentityProvider } from '../../../src/utils/enums/identity-provider.enum';
import { RoleCode } from '../../../src/utils/enums/role-code.enum';
import { SubscriptionTier } from '../../../src/utils/enums/subscription-tier.enum';
import { SystemActionType } from '../../../src/utils/enums/system-action-type.enum';
import { UserStatus } from '../../../src/utils/enums/user-status.enum';

const ACTOR_ID = 'admin-1';
const CREATED_AT = new Date('2026-11-17T03:00:00.000Z');
const DTO = {
  email: 'nxb@example.com',
  publisherName: 'Nhà xuất bản Kim Đồng',
  note: 'Đơn từ nxb@example.com ngày 17/11',
};
const TARGET = {
  id: 'publisher-1',
  userId: 'user-1',
  email: 'nxb@example.com',
  publisherName: 'Nhà xuất bản Kim Đồng',
  status: UserStatus.ACTIVE,
};

const uniqueViolation = (constraint: string) =>
  new QueryFailedError('INSERT', [], {
    code: '23505',
    constraint,
  } as unknown as Error);

describe('PublishersService', () => {
  // Query builder giả: mọi hàm nối chuỗi trả lại chính nó
  const queryBuilder = {
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
    getCount: jest.fn(),
  } as Record<string, jest.Mock>;
  for (const method of [
    'leftJoin',
    'innerJoin',
    'select',
    'addSelect',
    'where',
    'orderBy',
    'addOrderBy',
    'offset',
    'limit',
    'setLock',
    'clone',
  ]) {
    queryBuilder[method] = jest.fn(() => queryBuilder);
  }

  const manager = {
    existsBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    insert: jest.fn(),
    find: jest.fn(),
    findOneOrFail: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    query: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
    transaction: jest.fn(),
  };
  manager.transaction.mockImplementation(
    (work: (m: typeof manager) => unknown) => work(manager),
  );
  const mailQueueService = {
    enqueueAccountCredentialsEmail: jest.fn(),
    enqueueAccountPasswordResetEmail: jest.fn(),
    enqueuePublisherStatusEmail: jest.fn(),
  };
  const redis = { incr: jest.fn(), expire: jest.fn(), decr: jest.fn() };
  const service = new PublishersService(
    { manager } as unknown as Repository<Publisher>,
    mailQueueService as unknown as MailQueueService,
    redis as unknown as Redis,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    manager.existsBy.mockResolvedValue(false);
    manager.findOneOrFail.mockResolvedValue({ name: 'Quản trị viên' });
    manager.create.mockImplementation((_entity, data: object) => data);
    manager.save.mockImplementation((data: { role?: RoleCode }) =>
      data.role
        ? { ...data, id: 'user-1' }
        : { ...data, id: 'publisher-1', createdAt: CREATED_AT },
    );
    manager.find.mockResolvedValue([]);
    queryBuilder.getRawMany.mockResolvedValue([]);
    queryBuilder.getRawOne.mockResolvedValue({ ...TARGET });
    redis.incr.mockResolvedValue(1);
    mailQueueService.enqueueAccountCredentialsEmail.mockResolvedValue(
      undefined,
    );
    mailQueueService.enqueueAccountPasswordResetEmail.mockResolvedValue(
      undefined,
    );
  });

  describe('create', () => {
    it('creates the account and profile, logs on publishers.id, then queues the email', async () => {
      await expect(service.create(ACTOR_ID, DTO)).resolves.toEqual({
        id: 'publisher-1',
        email: DTO.email,
        publisherName: DTO.publisherName,
        slug: 'nha-xuat-ban-kim-dong',
        subscriptionTier: SubscriptionTier.NONE,
        createdAt: CREATED_AT,
      });

      expect(manager.create).toHaveBeenCalledWith(User, {
        role: RoleCode.PUBLISHER,
        name: DTO.publisherName,
        notificationEmail: DTO.email,
        notificationEmailVerified: true,
      });
      expect(manager.insert).toHaveBeenCalledWith(Provider, {
        userId: 'user-1',
        provider: IdentityProvider.LOCAL,
        providerKey: DTO.email,
        verified: true,
        passwordHash: null,
      });
      expect(manager.create).toHaveBeenCalledWith(Publisher, {
        userId: 'user-1',
        publisherName: DTO.publisherName,
        slug: 'nha-xuat-ban-kim-dong',
        subscriptionTier: SubscriptionTier.NONE,
      });
      expect(manager.insert).toHaveBeenCalledWith(SystemLog, {
        actorId: ACTOR_ID,
        actorName: 'Quản trị viên',
        actionType: SystemActionType.PUBLISHER_CREATION,
        targetId: 'publisher-1',
        targetName: DTO.publisherName,
        note: DTO.note,
      });
      expect(
        mailQueueService.enqueueAccountCredentialsEmail,
      ).toHaveBeenCalledWith('user-1', DTO.email, 'publisher');
    });

    it('numbers the slug when the name is taken', async () => {
      queryBuilder.getRawMany.mockResolvedValue([
        { slug: 'nha-xuat-ban-kim-dong' },
        { slug: 'nha-xuat-ban-kim-dong-2' },
      ]);

      await expect(service.create(ACTOR_ID, DTO)).resolves.toMatchObject({
        slug: 'nha-xuat-ban-kim-dong-3',
      });
    });

    it('cuts users.name to 100 characters but keeps the full publisher name', async () => {
      const publisherName = 'Đ'.repeat(150);

      await service.create(ACTOR_ID, { ...DTO, publisherName });

      expect(manager.create).toHaveBeenCalledWith(
        User,
        expect.objectContaining({ name: 'Đ'.repeat(100) }),
      );
      expect(manager.create).toHaveBeenCalledWith(
        Publisher,
        expect.objectContaining({ publisherName }),
      );
    });

    it('returns 409 when the email already logs in with a password', async () => {
      manager.existsBy.mockResolvedValue(true);

      await expect(service.create(ACTOR_ID, DTO)).rejects.toMatchObject({
        code: 2000,
      });
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('returns 409 when a parallel request took the email', async () => {
      manager.transaction.mockRejectedValueOnce(
        uniqueViolation('providers_provider_provider_key_key'),
      );

      await expect(service.create(ACTOR_ID, DTO)).rejects.toMatchObject({
        code: 2000,
      });
    });

    it('fails without retrying when a parallel request took the slug (not "email exists")', async () => {
      const taken = uniqueViolation('publishers_slug_key');
      manager.transaction.mockRejectedValueOnce(taken);

      await expect(service.create(ACTOR_ID, DTO)).rejects.toBe(taken);
      expect(manager.transaction).toHaveBeenCalledTimes(1);
      expect(
        mailQueueService.enqueueAccountCredentialsEmail,
      ).not.toHaveBeenCalled();
    });

    it('still returns 201 when the email job cannot be queued', async () => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation();
      mailQueueService.enqueueAccountCredentialsEmail.mockRejectedValue(
        new Error('Redis down'),
      );

      await expect(service.create(ACTOR_ID, DTO)).resolves.toMatchObject({
        id: 'publisher-1',
      });
    });
  });

  describe('list', () => {
    it('lists newest first without a keyword', async () => {
      queryBuilder.getCount.mockResolvedValue(45);

      await expect(
        service.list({ page: 2, limit: 20, q: '' }),
      ).resolves.toEqual({
        items: [],
        page: 2,
        limit: 20,
        total: 45,
        totalPages: 3,
      });

      expect(queryBuilder.where).not.toHaveBeenCalled();
      expect(queryBuilder.addOrderBy).toHaveBeenNthCalledWith(
        1,
        'publisher.created_at',
        'DESC',
      );
      expect(queryBuilder.offset).toHaveBeenCalledWith(20);
      expect(queryBuilder.limit).toHaveBeenCalledWith(20);
    });

    it('only matches a substring for keywords under 3 characters', async () => {
      queryBuilder.getCount.mockResolvedValue(0);

      await service.list({ page: 1, limit: 20, q: '1%' });

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'publisher.search_text ILIKE f_unaccent(:like)',
        { like: '%1\\%%' },
      );
      expect(queryBuilder.orderBy).not.toHaveBeenCalled();
    });

    it('only matches fuzzily (no substring) and ranks by similarity from 3 characters', async () => {
      queryBuilder.getCount.mockResolvedValue(0);

      await service.list({ page: 1, limit: 20, q: 'kim dong' });

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'f_unaccent(:q) <% publisher.search_text',
        { q: 'kim dong' },
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'word_similarity(f_unaccent(:q), publisher.search_text)',
        'DESC',
      );
    });
  });

  it('returns 404 for an unknown publisher', async () => {
    queryBuilder.getRawOne.mockResolvedValue(undefined);

    await expect(service.findOne('publisher-x')).rejects.toMatchObject({
      code: 1003,
    });
  });

  it('returns 404 when listing editors of an unknown publisher', async () => {
    manager.existsBy.mockResolvedValue(false);

    await expect(service.listEditors('publisher-x')).rejects.toMatchObject({
      code: 1003,
    });
  });

  describe('resetPassword', () => {
    it('clears the password, logs out, logs the note, and emails the reason', async () => {
      await expect(
        service.resetPassword(ACTOR_ID, 'publisher-1', 'NXB báo mất mail'),
      ).resolves.toEqual({});

      expect(redis.incr).toHaveBeenCalledWith(
        'admin:password-reset-quota:publisher:publisher-1',
      );
      expect(queryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(manager.update).toHaveBeenCalledWith(
        Provider,
        { userId: 'user-1', provider: IdentityProvider.LOCAL },
        { passwordHash: null },
      );
      expect(manager.delete).toHaveBeenCalledWith(RefreshToken, {
        userId: 'user-1',
      });
      expect(manager.insert).toHaveBeenCalledWith(SystemLog, {
        actorId: ACTOR_ID,
        actorName: 'Quản trị viên',
        actionType: SystemActionType.PUBLISHER_PASSWORD_RESET,
        targetId: 'publisher-1',
        targetName: TARGET.publisherName,
        note: 'NXB báo mất mail',
      });
      expect(
        mailQueueService.enqueueAccountPasswordResetEmail,
      ).toHaveBeenCalledWith(
        'user-1',
        TARGET.email,
        'publisher',
        'NXB báo mất mail',
      );
    });

    it('refuses the 4th reset of the day before touching anything', async () => {
      redis.incr.mockResolvedValue(4);

      await expect(
        service.resetPassword(ACTOR_ID, 'publisher-1', 'x'),
      ).rejects.toMatchObject({ code: 3003 });
      expect(manager.transaction).not.toHaveBeenCalled();
    });

    it.each([
      ['locked', { ...TARGET, status: UserStatus.LOCKED }, 3002],
      ['unknown', undefined, 1003],
    ])(
      'refuses a %s publisher and gives the turn back',
      async (_label, target, code) => {
        queryBuilder.getRawOne.mockResolvedValue(target);

        await expect(
          service.resetPassword(ACTOR_ID, 'publisher-1', 'x'),
        ).rejects.toMatchObject({ code });
        expect(manager.update).not.toHaveBeenCalled();
        expect(redis.decr).toHaveBeenCalledWith(
          'admin:password-reset-quota:publisher:publisher-1',
        );
      },
    );

    it('returns 503 when the email cannot be queued', async () => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation();
      mailQueueService.enqueueAccountPasswordResetEmail.mockRejectedValue(
        new Error('Redis down'),
      );

      await expect(
        service.resetPassword(ACTOR_ID, 'publisher-1', 'x'),
      ).rejects.toMatchObject({ code: 1006 });
    });
  });

  describe('lock', () => {
    it('locks the publisher and every editor, logs them out, leaves surveys untouched', async () => {
      manager.find.mockResolvedValue([
        { userId: 'editor-user-1' },
        { userId: 'editor-user-2' },
      ]);
      const accounts = ['user-1', 'editor-user-1', 'editor-user-2'];

      await expect(
        service.lock(ACTOR_ID, 'publisher-1', 'Bị chiếm tài khoản'),
      ).resolves.toEqual({});

      expect(manager.update).toHaveBeenCalledWith(
        User,
        { id: In(accounts) },
        { status: UserStatus.LOCKED },
      );
      expect(manager.delete).toHaveBeenCalledWith(RefreshToken, {
        userId: In(accounts),
      });
      expect(manager.query).not.toHaveBeenCalled();
      expect(
        mailQueueService.enqueuePublisherStatusEmail,
      ).toHaveBeenCalledWith(MailJob.PUBLISHER_SUSPENDED, {
        userId: 'user-1',
        email: 'nxb@example.com',
        publisherName: 'Nhà xuất bản Kim Đồng',
        reason: 'Bị chiếm tài khoản',
      });
      expect(manager.insert).toHaveBeenCalledWith(
        SystemLog,
        expect.objectContaining({
          actionType: SystemActionType.PUBLISHER_SUSPENDED,
          targetId: 'publisher-1',
          note: 'Bị chiếm tài khoản',
        }),
      );
    });

    it('returns 409 when the publisher is already locked', async () => {
      queryBuilder.getRawOne.mockResolvedValue({
        ...TARGET,
        status: UserStatus.LOCKED,
      });

      await expect(
        service.lock(ACTOR_ID, 'publisher-1', 'x'),
      ).rejects.toMatchObject({ code: 3000 });
      expect(manager.update).not.toHaveBeenCalled();
    });
  });

  describe('unlock', () => {
    it('unlocks the publisher and every editor', async () => {
      queryBuilder.getRawOne.mockResolvedValue({
        ...TARGET,
        status: UserStatus.LOCKED,
      });
      manager.find.mockResolvedValue([{ userId: 'editor-user-1' }]);

      await expect(
        service.unlock(ACTOR_ID, 'publisher-1', 'Đã xác minh'),
      ).resolves.toEqual({});

      expect(manager.update).toHaveBeenCalledWith(
        User,
        { id: In(['user-1', 'editor-user-1']) },
        { status: UserStatus.ACTIVE },
      );
      expect(manager.insert).toHaveBeenCalledWith(
        SystemLog,
        expect.objectContaining({
          actionType: SystemActionType.PUBLISHER_UNSUSPENDED,
          note: 'Đã xác minh',
        }),
      );
      expect(
        mailQueueService.enqueuePublisherStatusEmail,
      ).toHaveBeenCalledWith(MailJob.PUBLISHER_UNSUSPENDED, {
        userId: 'user-1',
        email: 'nxb@example.com',
        publisherName: 'Nhà xuất bản Kim Đồng',
        reason: 'Đã xác minh',
      });
    });

    it('still succeeds when the email job cannot be queued', async () => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation();
      queryBuilder.getRawOne.mockResolvedValue({
        ...TARGET,
        status: UserStatus.LOCKED,
      });
      mailQueueService.enqueuePublisherStatusEmail.mockRejectedValue(
        new Error('Redis down'),
      );

      await expect(
        service.unlock(ACTOR_ID, 'publisher-1', 'x'),
      ).resolves.toEqual({});
    });

    it('returns 409 when the publisher is not locked', async () => {
      await expect(
        service.unlock(ACTOR_ID, 'publisher-1', 'x'),
      ).rejects.toMatchObject({ code: 3001 });
    });
  });

  describe('remove', () => {
    it('logs first, then deletes the publisher and editor accounts (the rest cascades)', async () => {
      manager.find.mockResolvedValue([{ userId: 'editor-user-1' }]);

      await expect(
        service.remove(ACTOR_ID, 'publisher-1', 'Vi phạm điều khoản'),
      ).resolves.toEqual({});

      expect(queryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(manager.insert).toHaveBeenCalledWith(
        SystemLog,
        expect.objectContaining({
          actorId: ACTOR_ID,
          actionType: SystemActionType.PUBLISHER_DELETION,
          targetId: 'publisher-1',
          targetName: 'Nhà xuất bản Kim Đồng',
          note: 'Vi phạm điều khoản',
        }),
      );
      expect(manager.delete).toHaveBeenCalledWith(User, {
        id: In(['user-1', 'editor-user-1']),
      });
      expect(manager.insert.mock.invocationCallOrder[0]).toBeLessThan(
        manager.delete.mock.invocationCallOrder[0],
      );
    });

    it('returns 404 for an unknown publisher', async () => {
      queryBuilder.getRawOne.mockResolvedValue(undefined);

      await expect(
        service.remove(ACTOR_ID, 'publisher-x', 'x'),
      ).rejects.toMatchObject({ code: 1003 });
      expect(manager.delete).not.toHaveBeenCalled();
    });
  });
});
