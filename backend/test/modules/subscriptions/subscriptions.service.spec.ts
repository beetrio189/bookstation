import { Repository } from 'typeorm';
import { Plan } from '../../../src/modules/subscriptions/entities/plan.entity';
import { SubscriptionsService } from '../../../src/modules/subscriptions/subscriptions.service';

describe('SubscriptionsService', () => {
  const queryBuilder = { getRawMany: jest.fn() } as Record<string, jest.Mock>;
  for (const method of ['select', 'addSelect', 'orderBy', 'addOrderBy']) {
    queryBuilder[method] = jest.fn(() => queryBuilder);
  }
  const service = new SubscriptionsService({
    createQueryBuilder: jest.fn(() => queryBuilder),
  } as unknown as Repository<Plan>);

  beforeEach(() => jest.clearAllMocks());

  it('returns every plan with fixed public columns, ordered by duration then price', async () => {
    const rows = [
      { id: 'plan-1', name: 'Basic', durationMonths: 6 },
      { id: 'plan-free', name: 'Free', durationMonths: null },
    ];
    queryBuilder.getRawMany.mockResolvedValue(rows);

    await expect(service.listPlans()).resolves.toEqual({ items: rows });

    const columns = [
      ...queryBuilder.select.mock.calls,
      ...queryBuilder.addSelect.mock.calls,
    ].map(([, alias]) => alias as string);
    expect(columns).toEqual([
      'id',
      'name',
      'description',
      'price',
      'durationMonths',
      'bookLimit',
      'editorLimit',
    ]);
    expect(queryBuilder.addSelect).toHaveBeenCalledWith(
      expect.stringContaining("WHEN plan.duration = 'infinity' THEN NULL"),
      'durationMonths',
    );
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('plan.duration', 'ASC');
    expect(queryBuilder.addOrderBy).toHaveBeenCalledWith('plan.price', 'ASC');
  });
});
