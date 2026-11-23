import { DataSource } from 'typeorm';
import { PublisherPlansService } from '../../../src/modules/publishers/publisher-plans.service';

describe('PublisherPlansService', () => {
  const query = jest.fn();
  const service = new PublisherPlansService({
    query,
  } as unknown as DataSource);

  beforeEach(() => jest.clearAllMocks());

  it('returns the public plan columns plus canBuy for the owning publisher', async () => {
    const rows = [
      { id: 'plan-1', name: 'Basic', durationMonths: 6, canBuy: true },
      { id: 'plan-free', name: 'Free', durationMonths: null, canBuy: false },
    ];
    query.mockResolvedValue(rows);

    await expect(service.listPlans('user-1')).resolves.toEqual({
      items: rows,
    });

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual(['user-1']);
    expect(sql).toContain('WHERE p.user_id = $1');
    expect(sql).toContain("plan.duration <> 'infinity'");
    expect(sql).toContain('usage.books <= plan.book_limit');
    expect(sql).toContain('usage.editors <= plan.editor_limit');
    expect(sql).toContain('ORDER BY plan.duration ASC, plan.price ASC');
  });
});
