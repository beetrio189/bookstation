import { EntityManager } from 'typeorm';
import { Payment } from '../../../src/modules/subscriptions/entities/payment.entity';
import { lockPayment } from '../../../src/modules/subscriptions/payment-success';
import { Publisher } from '../../../src/modules/publishers/entities/publisher.entity';

describe('lockPayment', () => {
  const findOne = jest.fn();
  const manager = { findOne } as unknown as EntityManager;
  const lock = { mode: 'pessimistic_write' };

  beforeEach(() => jest.clearAllMocks());

  it('locks the publisher before the payment', async () => {
    findOne
      .mockResolvedValueOnce({ id: 'pay-1', publisherId: 'pub-1' })
      .mockResolvedValueOnce({ id: 'pub-1' })
      .mockResolvedValueOnce({ id: 'pay-1', status: 'pending' });

    await expect(
      lockPayment(manager, { orderCode: 'BSABCD1234' }),
    ).resolves.toEqual({
      payment: { id: 'pay-1', status: 'pending' },
      publisher: { id: 'pub-1' },
    });
    expect(findOne.mock.calls).toEqual([
      [Payment, { where: { orderCode: 'BSABCD1234' } }],
      [Publisher, { where: { id: 'pub-1' }, lock }],
      [Payment, { where: { id: 'pay-1' }, lock }],
    ]);
  });

  it('only locks the payment when the publisher was deleted', async () => {
    findOne
      .mockResolvedValueOnce({ id: 'pay-1', publisherId: null })
      .mockResolvedValueOnce({ id: 'pay-1' });

    await expect(lockPayment(manager, { id: 'pay-1' })).resolves.toEqual({
      payment: { id: 'pay-1' },
      publisher: null,
    });
    expect(findOne).toHaveBeenCalledTimes(2);
  });

  it('returns nothing for an unknown order', async () => {
    findOne.mockResolvedValueOnce(null);

    await expect(
      lockPayment(manager, { orderCode: 'BSZZZZ9999' }),
    ).resolves.toEqual({ payment: null, publisher: null });
    expect(findOne).toHaveBeenCalledTimes(1);
  });
});
