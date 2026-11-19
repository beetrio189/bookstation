import { QueryFailedError, Repository } from 'typeorm';
import { PlansService } from '../../../src/modules/admin/plans.service';
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
  note: 'Mở bán',
};

describe('PlansService', () => {
  const manager = {
    query: jest.fn(),
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    insert: jest.fn(),
    transaction: jest.fn(),
  };
  manager.transaction.mockImplementation(
    (work: (m: typeof manager) => unknown) => work(manager),
  );
  // Query builder giả: mọi hàm nối chuỗi trả lại chính nó
  const queryBuilder = { getRawMany: jest.fn() } as Record<string, jest.Mock>;
  for (const method of ['select', 'addSelect', 'orderBy', 'addOrderBy']) {
    queryBuilder[method] = jest.fn(() => queryBuilder);
  }
  const service = new PlansService({
    manager,
    createQueryBuilder: jest.fn(() => queryBuilder),
  } as unknown as Repository<Plan>);

  // INSERT ... RETURNING
  const mockInsert = () =>
    manager.query.mockResolvedValueOnce([
      { id: 'plan-1', createdAt: CREATED_AT },
    ]);

  beforeEach(() => {
    jest.clearAllMocks();
    manager.findOneOrFail.mockResolvedValue({ name: 'Quản trị viên' });
  });

  it('inserts with make_interval, logs, and returns the plan', async () => {
    mockInsert();

    await expect(service.create(ADMIN_ID, DTO)).resolves.toEqual({
      id: 'plan-1',
      name: 'basic',
      durationMonths: 6,
      description: 'Cho NXB nhỏ',
      price: 500000,
      bookLimit: 100000,
      editorLimit: 2,
      createdAt: CREATED_AT,
    });

    // Chỉ một câu INSERT: không còn khóa / so hạn mức theo tên
    expect(manager.query).toHaveBeenCalledTimes(1);
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('make_interval(months => $2)'),
      ['basic', 6, 'Cho NXB nhỏ', 500000, 100000, 2],
    );
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
    expect(manager.query).toHaveBeenCalledWith(expect.any(String), [
      'basic',
      6,
      null,
      500000,
      100000,
      2,
    ]);
  });

  it('maps a duplicate (name, duration) to PLAN_ALREADY_EXISTS', async () => {
    manager.query.mockRejectedValueOnce(
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
    manager.query.mockRejectedValueOnce(failure);

    await expect(service.create(ADMIN_ID, DTO)).rejects.toBe(failure);
  });

  describe('list', () => {
    it('returns every plan ordered by duration then price, Free without months', async () => {
      const rows = [
        { id: 'plan-1', name: 'basic', durationMonths: 6, isActive: false },
        { id: 'plan-free', name: 'Free', durationMonths: null, isActive: true },
      ];
      queryBuilder.getRawMany.mockResolvedValue(rows);

      await expect(service.list()).resolves.toEqual({ items: rows });

      expect(queryBuilder.addSelect).toHaveBeenCalledWith(
        expect.stringContaining("WHEN plan.duration = 'infinity' THEN NULL"),
        'durationMonths',
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('plan.duration', 'ASC');
      expect(queryBuilder.addOrderBy).toHaveBeenCalledWith('plan.price', 'ASC');
      // Không lọc is_active: admin thấy cả gói đã ẩn (query builder giả không có where)
    });
  });
});
