import { Logger } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { PlansService } from '../../../src/modules/admin/plans.service';
import { MailQueueService } from '../../../src/modules/mail/mail-queue.service';
import { Plan } from '../../../src/modules/subscriptions/entities/plan.entity';
import { SystemLog } from '../../../src/modules/system-logs/entities/system-log.entity';
import { SystemActionType } from '../../../src/utils/enums/system-action-type.enum';

const ADMIN_ID = 'admin-1';
const CREATED_AT = new Date('2026-11-19T03:00:00.000Z');
const DTO = {
  name: 'basic',
  durationMonths: 6,
  description: 'Cho NXB nhỏ',
  price: 500000,
  bookLimit: 100000,
  editorLimit: 2,
  featuredWeight: 1,
  note: 'Mở bán',
};

// Một dòng gói như selectPlanFields trả về
const PAID = {
  id: 'plan-1',
  name: 'basic',
  durationMonths: 6,
  description: 'Cho NXB nhỏ',
  price: 500000,
  bookLimit: 100000,
  editorLimit: 2,
  featuredWeight: 1,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};
const FREE = {
  ...PAID,
  id: 'plan-free',
  name: 'Free',
  durationMonths: null,
  price: 0,
  bookLimit: 0,
  editorLimit: 0,
};

describe('PlansService', () => {
  // Query builder giả: mọi hàm nối chuỗi trả lại chính nó
  const queryBuilder = {
    getRawMany: jest.fn(),
    getRawOne: jest.fn(),
  } as Record<string, jest.Mock>;
  for (const method of [
    'select',
    'addSelect',
    'orderBy',
    'addOrderBy',
    'where',
    'setLock',
  ]) {
    queryBuilder[method] = jest.fn(() => queryBuilder);
  }
  const manager = {
    query: jest.fn(),
    create: jest.fn((_entity: unknown, values: object) => values),
    save: jest.fn(),
    findOneOrFail: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
    transaction: jest.fn(),
  };
  manager.transaction.mockImplementation(
    (work: (m: typeof manager) => unknown) => work(manager),
  );
  const mailQueueService = {
    enqueuePlanUpdated: jest.fn(),
    enqueuePlanDeletedNotices: jest.fn(),
  };
  const service = new PlansService(
    {
      manager,
      createQueryBuilder: jest.fn(() => queryBuilder),
    } as unknown as Repository<Plan>,
    mailQueueService as unknown as MailQueueService,
  );

  // save() trả lại entity kèm cột DB sinh ra
  const mockInsert = () =>
    manager.save.mockImplementationOnce((plan: object) =>
      Promise.resolve({ ...plan, id: 'plan-1', createdAt: CREATED_AT }),
    );

  beforeEach(() => {
    jest.clearAllMocks();
    queryBuilder.getRawOne.mockReset();
    manager.query.mockReset();
    manager.save.mockReset();
    manager.update.mockReset();
    manager.findOneOrFail.mockResolvedValue({ name: 'Quản trị viên' });
    mailQueueService.enqueuePlanUpdated.mockResolvedValue(undefined);
    mailQueueService.enqueuePlanDeletedNotices.mockResolvedValue(undefined);
  });

  // Lần 1: khóa dòng (giá trị cũ), lần 2: đọc lại sau UPDATE
  const mockPlanReads = (before: object, after: object) =>
    queryBuilder.getRawOne
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after);

  it('saves the plan with an interval duration, logs, and returns it', async () => {
    mockInsert();

    await expect(service.create(ADMIN_ID, DTO)).resolves.toEqual({
      id: 'plan-1',
      name: 'basic',
      durationMonths: 6,
      description: 'Cho NXB nhỏ',
      price: 500000,
      bookLimit: 100000,
      editorLimit: 2,
      featuredWeight: 1,
      createdAt: CREATED_AT,
    });

    expect(manager.save).toHaveBeenCalledTimes(1);
    expect(manager.create).toHaveBeenCalledWith(Plan, {
      name: 'basic',
      duration: '6 months',
      description: 'Cho NXB nhỏ',
      price: 500000,
      bookLimit: 100000,
      editorLimit: 2,
      featuredWeight: 1,
    });
    expect(manager.insert).toHaveBeenCalledWith(SystemLog, {
      actorId: ADMIN_ID,
      actorName: 'Quản trị viên',
      actionType: SystemActionType.PLAN_CREATION,
      targetId: 'plan-1',
      targetName: 'basic (6 tháng)',
      note: 'Mở bán',
    });
  });

  it('stores an empty description as NULL', async () => {
    mockInsert();

    await expect(
      service.create(ADMIN_ID, { ...DTO, description: '' }),
    ).resolves.toMatchObject({ description: null });
    expect(manager.create).toHaveBeenCalledWith(
      Plan,
      expect.objectContaining({ description: null }),
    );
  });

  it('stores the featured weight sent by the admin', async () => {
    mockInsert();

    await expect(
      service.create(ADMIN_ID, { ...DTO, featuredWeight: 5 }),
    ).resolves.toMatchObject({ featuredWeight: 5 });
    expect(manager.create).toHaveBeenCalledWith(
      Plan,
      expect.objectContaining({ featuredWeight: 5 }),
    );
  });

  it('maps a duplicate (name, duration) to PLAN_ALREADY_EXISTS', async () => {
    manager.save.mockRejectedValueOnce(
      new QueryFailedError('INSERT', [], {
        code: '23505',
      } as unknown as Error),
    );

    await expect(service.create(ADMIN_ID, DTO)).rejects.toMatchObject({
      code: 3004,
    });
  });

  it('rethrows other database errors', async () => {
    const failure = new Error('connection lost');
    manager.save.mockRejectedValueOnce(failure);

    await expect(service.create(ADMIN_ID, DTO)).rejects.toBe(failure);
  });

  describe('list', () => {
    it('returns every plan ordered by duration then price, Free without months', async () => {
      const rows = [
        { id: 'plan-1', name: 'basic', durationMonths: 6 },
        { id: 'plan-free', name: 'Free', durationMonths: null },
      ];
      queryBuilder.getRawMany.mockResolvedValue(rows);

      await expect(service.list()).resolves.toEqual({ items: rows });

      expect(queryBuilder.addSelect).toHaveBeenCalledWith(
        expect.stringContaining("WHEN plan.duration = 'infinity' THEN NULL"),
        'durationMonths',
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('plan.duration', 'ASC');
      expect(queryBuilder.addOrderBy).toHaveBeenCalledWith('plan.price', 'ASC');
    });
  });

  describe('update', () => {
    // Body PUT đủ trường, khớp PAID
    const PUT = {
      name: 'basic',
      description: 'Cho NXB nhỏ',
      price: 500000,
      bookLimit: 100000,
      editorLimit: 2,
      featuredWeight: 1,
      note: 'Sửa gói',
    };
    const FREE_PUT = {
      ...PUT,
      name: 'Free',
      price: 0,
      bookLimit: 0,
      editorLimit: 0,
    };

    it('replaces every field, logs plan_update, and queues the notice when the price changes', async () => {
      mockPlanReads(PAID, { ...PAID, name: 'Basic Plus', price: 600000 });

      await expect(
        service.update(ADMIN_ID, 'plan-1', {
          ...PUT,
          name: 'Basic Plus',
          price: 600000,
          note: 'Tăng giá',
        }),
      ).resolves.toMatchObject({ name: 'Basic Plus', price: 600000 });

      expect(queryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(manager.update).toHaveBeenCalledWith(
        Plan,
        { id: 'plan-1' },
        {
          name: 'Basic Plus',
          description: 'Cho NXB nhỏ',
          price: 600000,
          bookLimit: 100000,
          editorLimit: 2,
          featuredWeight: 1,
        },
      );
      expect(manager.insert).toHaveBeenCalledWith(SystemLog, {
        actorId: ADMIN_ID,
        actorName: 'Quản trị viên',
        actionType: SystemActionType.PLAN_UPDATE,
        targetId: 'plan-1',
        targetName: 'Basic Plus (6 tháng)',
        note: 'Tăng giá',
      });
      expect(mailQueueService.enqueuePlanUpdated).toHaveBeenCalledWith(
        'plan-1',
      );
    });

    it('stores a missing description as NULL and does not email for it', async () => {
      mockPlanReads(PAID, { ...PAID, description: null });

      await service.update(ADMIN_ID, 'plan-1', {
        ...PUT,
        description: undefined,
      });

      expect(manager.update).toHaveBeenCalledWith(
        Plan,
        { id: 'plan-1' },
        expect.objectContaining({ description: null }),
      );
      expect(mailQueueService.enqueuePlanUpdated).not.toHaveBeenCalled();
    });

    it('returns the plan without updating or logging when nothing changed', async () => {
      queryBuilder.getRawOne.mockResolvedValueOnce(PAID);

      await expect(service.update(ADMIN_ID, 'plan-1', PUT)).resolves.toBe(PAID);

      expect(manager.update).not.toHaveBeenCalled();
      expect(manager.insert).not.toHaveBeenCalled();
      expect(mailQueueService.enqueuePlanUpdated).not.toHaveBeenCalled();
    });

    it('lets the Free plan change its limits at 0 đ, logged as forever', async () => {
      mockPlanReads(FREE, { ...FREE, bookLimit: 10 });

      await service.update(ADMIN_ID, 'plan-free', {
        ...FREE_PUT,
        bookLimit: 10,
      });

      expect(manager.insert).toHaveBeenCalledWith(
        SystemLog,
        expect.objectContaining({ targetName: 'Free (vĩnh viễn)' }),
      );
      expect(mailQueueService.enqueuePlanUpdated).toHaveBeenCalledWith(
        'plan-free',
      );
    });

    it('refuses a price above 0 đ on the Free plan', async () => {
      queryBuilder.getRawOne.mockResolvedValueOnce(FREE);

      await expect(
        service.update(ADMIN_ID, 'plan-free', { ...FREE_PUT, price: 1 }),
      ).rejects.toMatchObject({ code: 3006 });
      expect(manager.update).not.toHaveBeenCalled();
    });

    it.each([0, 999])(
      'refuses a price of %i đ on a paid plan (SePay minimum)',
      async (price) => {
        queryBuilder.getRawOne.mockResolvedValueOnce(PAID);

        await expect(
          service.update(ADMIN_ID, 'plan-1', { ...PUT, price }),
        ).rejects.toMatchObject({ code: 3010 });
        expect(manager.update).not.toHaveBeenCalled();
      },
    );

    it('returns 404 for an unknown plan', async () => {
      queryBuilder.getRawOne.mockResolvedValueOnce(undefined);

      await expect(
        service.update(ADMIN_ID, 'plan-x', PUT),
      ).rejects.toMatchObject({ code: 1003 });
    });

    it('maps a duplicate (name, duration) to PLAN_ALREADY_EXISTS', async () => {
      queryBuilder.getRawOne.mockResolvedValueOnce(PAID);
      manager.update.mockRejectedValueOnce(
        new QueryFailedError('UPDATE', [], {
          code: '23505',
        } as unknown as Error),
      );

      await expect(
        service.update(ADMIN_ID, 'plan-1', { ...PUT, name: 'pro' }),
      ).rejects.toMatchObject({ code: 3004 });
    });

    it('still returns the plan when the notice cannot be queued', async () => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation();
      mockPlanReads(PAID, { ...PAID, price: 1000 });
      mailQueueService.enqueuePlanUpdated.mockRejectedValueOnce(
        new Error('Redis down'),
      );

      await expect(
        service.update(ADMIN_ID, 'plan-1', { ...PUT, price: 1000 }),
      ).resolves.toMatchObject({ price: 1000 });
    });
  });

  describe('remove', () => {
    const SUBSCRIBER = {
      userId: 'user-1',
      email: 'nxb@example.com',
      planName: 'basic',
      periodEndsAt: new Date('2027-05-01T00:00:00.000Z'),
    };

    it('finds subscribers before deleting, logs, then queues one notice each', async () => {
      queryBuilder.getRawOne.mockResolvedValueOnce(PAID);
      manager.query.mockResolvedValueOnce([SUBSCRIBER]);

      await expect(
        service.remove(ADMIN_ID, 'plan-1', { note: 'Ngừng bán' }),
      ).resolves.toEqual({});

      expect(manager.query).toHaveBeenCalledWith(
        expect.stringContaining('pm.plan_id = $1'),
        ['plan-1', 'active'],
      );
      expect(manager.delete).toHaveBeenCalledWith(Plan, { id: 'plan-1' });
      expect(manager.insert).toHaveBeenCalledWith(SystemLog, {
        actorId: ADMIN_ID,
        actorName: 'Quản trị viên',
        actionType: SystemActionType.PLAN_DELETION,
        targetId: 'plan-1',
        targetName: 'basic (6 tháng)',
        note: 'Ngừng bán',
      });
      expect(mailQueueService.enqueuePlanDeletedNotices).toHaveBeenCalledWith([
        {
          userId: 'user-1',
          email: 'nxb@example.com',
          planName: 'basic',
          periodEndsAt: '2027-05-01T00:00:00.000Z',
        },
      ]);
    });

    it('skips the queue when nobody is using the plan', async () => {
      queryBuilder.getRawOne.mockResolvedValueOnce(PAID);
      manager.query.mockResolvedValueOnce([]);

      await service.remove(ADMIN_ID, 'plan-1', { note: '' });

      expect(mailQueueService.enqueuePlanDeletedNotices).not.toHaveBeenCalled();
    });

    it('refuses to delete the Free plan', async () => {
      queryBuilder.getRawOne.mockResolvedValueOnce(FREE);

      await expect(
        service.remove(ADMIN_ID, 'plan-free', { note: '' }),
      ).rejects.toMatchObject({ code: 3007 });
      expect(manager.delete).not.toHaveBeenCalled();
    });

    it('returns 404 for an unknown plan', async () => {
      queryBuilder.getRawOne.mockResolvedValueOnce(undefined);

      await expect(
        service.remove(ADMIN_ID, 'plan-x', { note: '' }),
      ).rejects.toMatchObject({ code: 1003 });
    });

    it('still succeeds when the notices cannot be queued', async () => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation();
      queryBuilder.getRawOne.mockResolvedValueOnce(PAID);
      manager.query.mockResolvedValueOnce([SUBSCRIBER]);
      mailQueueService.enqueuePlanDeletedNotices.mockRejectedValueOnce(
        new Error('Redis down'),
      );

      await expect(
        service.remove(ADMIN_ID, 'plan-1', { note: '' }),
      ).resolves.toEqual({});
    });
  });
});
