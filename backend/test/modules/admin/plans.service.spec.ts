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
  const service = new PlansService({ manager } as unknown as Repository<Plan>);

  // Lần 1: advisory lock, lần 2: INSERT ... RETURNING
  const mockInsert = () =>
    manager.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'plan-1', createdAt: CREATED_AT }]);

  beforeEach(() => {
    jest.clearAllMocks();
    manager.findOne.mockResolvedValue(null);
    manager.findOneOrFail.mockResolvedValue({ name: 'Quản trị viên' });
  });

  it('locks on the name, inserts with make_interval, logs, and returns the plan', async () => {
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

    expect(manager.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('pg_advisory_xact_lock'),
      ['basic'],
    );
    expect(manager.query).toHaveBeenNthCalledWith(
      2,
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
    expect(manager.query).toHaveBeenNthCalledWith(2, expect.any(String), [
      'basic',
      6,
      null,
      500000,
      100000,
      2,
    ]);
  });

  it('accepts another duration of a name when the limits match', async () => {
    mockInsert();
    manager.findOne.mockResolvedValue({ bookLimit: 100000, editorLimit: 2 });

    await expect(service.create(ADMIN_ID, DTO)).resolves.toMatchObject({
      id: 'plan-1',
    });
  });

  it.each([
    ['book', { bookLimit: 200000, editorLimit: 2 }],
    ['editor', { bookLimit: 100000, editorLimit: 5 }],
  ])(
    'refuses a %s limit that differs from the plan with the same name',
    async (_label, existing) => {
      manager.query.mockResolvedValueOnce([]);
      manager.findOne.mockResolvedValue(existing);

      await expect(service.create(ADMIN_ID, DTO)).rejects.toMatchObject({
        code: 3005,
      });
      expect(manager.query).toHaveBeenCalledTimes(1);
      expect(manager.insert).not.toHaveBeenCalled();
    },
  );

  it('maps a duplicate (name, duration) to PLAN_ALREADY_EXISTS', async () => {
    manager.query.mockResolvedValueOnce([]).mockRejectedValueOnce(
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
});
