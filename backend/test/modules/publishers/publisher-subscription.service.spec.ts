import { DataSource } from 'typeorm';
import { PublisherSubscriptionService } from '../../../src/modules/publishers/publisher-subscription.service';
import { AppException } from '../../../src/utils/errors/app.exception';

describe('PublisherSubscriptionService', () => {
  const query = jest.fn();
  const service = new PublisherSubscriptionService({
    query,
  } as unknown as DataSource);

  beforeEach(() => jest.clearAllMocks());

  it('splits the row into current plan and usage', async () => {
    const endsAt = new Date('2027-05-20T00:00:00.000Z');
    query.mockResolvedValue([
      {
        planName: 'Pro',
        durationMonths: 12,
        bookLimit: 500000,
        editorLimit: 10,
        periodStartsAt: new Date('2026-05-20T00:00:00.000Z'),
        periodEndsAt: endsAt,
        creditBalance: 120000,
        books: 37,
        editors: 2,
      },
    ]);

    await expect(service.getCurrent('user-1')).resolves.toEqual({
      current: {
        planName: 'Pro',
        durationMonths: 12,
        bookLimit: 500000,
        editorLimit: 10,
        periodStartsAt: new Date('2026-05-20T00:00:00.000Z'),
        periodEndsAt: endsAt,
      },
      usage: { books: 37, editors: 2 },
      creditBalance: 120000,
    });
  });

  it('runs a single query that finds the publisher as owner or editor and falls back to Free', async () => {
    query.mockResolvedValue([
      {
        planName: 'Free',
        durationMonths: null,
        bookLimit: 0,
        editorLimit: 0,
        periodStartsAt: null,
        periodEndsAt: null,
        creditBalance: 0,
        books: 3,
        editors: 0,
      },
    ]);

    await expect(service.getCurrent('user-1')).resolves.toMatchObject({
      current: { planName: 'Free', durationMonths: null, bookLimit: 0 },
      usage: { books: 3, editors: 0 },
    });

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual(['user-1']);
    expect(sql).toContain('FROM publishers p WHERE p.user_id = $1');
    expect(sql).toContain('FROM editors e JOIN publishers p');
    expect(sql).toContain('me.credit_balance AS "creditBalance"');
    expect(sql).toContain("pm.status = 'success'");
    expect(sql).toContain("fp.duration = 'infinity'");
  });

  it('throws 404 when the user has no publisher', async () => {
    query.mockResolvedValue([]);

    await expect(service.getCurrent('user-1')).rejects.toBeInstanceOf(
      AppException,
    );
  });
});
