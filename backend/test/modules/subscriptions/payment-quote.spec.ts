import { EntityManager } from 'typeorm';
import {
  calculateQuote,
  quotePayment,
} from '../../../src/modules/subscriptions/payment-quote';
import { AppException } from '../../../src/utils/errors/app.exception';
import { ERRORS } from '../../../src/utils/errors/errors';

describe('payment quote', () => {
  const query = jest.fn();
  const manager = { query } as unknown as EntityManager;
  const row = {
    price: 300000,
    isFree: false,
    bookLimit: 50,
    editorLimit: 2,
    books: 10,
    editors: 1,
    creditBalance: 50000,
    creditReturned: 100000,
  };

  beforeEach(() => jest.clearAllMocks());

  it.each([
    // giá, credit dư, hoàn lại → creditUsed, total
    [300000, 50000, 100000, 150000, 150000],
    [100000, 50000, 100000, 100000, 0],
    [100000, 0, 0, 0, 100000],
  ])(
    'price %i, balance %i, returned %i → used %i, total %i',
    (price, balance, returned, used, total) => {
      expect(calculateQuote(price, balance, returned)).toEqual({
        price,
        creditBalance: balance,
        creditReturned: returned,
        creditUsed: used,
        total,
      });
    },
  );

  it('quotes from one query keyed by owner user id and plan id', async () => {
    query.mockResolvedValue([row]);

    await expect(quotePayment(manager, 'user-1', 'plan-1')).resolves.toEqual({
      price: 300000,
      creditBalance: 50000,
      creditReturned: 100000,
      creditUsed: 150000,
      total: 150000,
    });

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual(['user-1', 'plan-1']);
    expect(sql).toContain('WHERE me.user_id = $1');
    expect(sql).toContain("pm.status = 'success'");
    expect(sql).toContain(
      'floor(extract(epoch FROM pm.period_ends_at - now())',
    );
  });

  it.each([
    ['plan missing', [], ERRORS.NOT_FOUND],
    ['free plan', [{ ...row, isFree: true }], ERRORS.PLAN_NOT_PURCHASABLE],
    ['too many books', [{ ...row, books: 51 }], ERRORS.PLAN_LIMIT_EXCEEDED],
    ['too many editors', [{ ...row, editors: 3 }], ERRORS.PLAN_LIMIT_EXCEEDED],
  ])('rejects when %s', async (_, rows, error) => {
    query.mockResolvedValue(rows);

    const promise = quotePayment(manager, 'user-1', 'plan-1');
    await expect(promise).rejects.toBeInstanceOf(AppException);
    await expect(promise).rejects.toMatchObject({
      response: expect.objectContaining({ code: error.code }),
    });
  });
});
