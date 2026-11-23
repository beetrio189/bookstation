import { DataSource, EntityManager } from 'typeorm';
import { settlePendingPayment } from '../../../src/modules/subscriptions/payment-settle';
import * as paymentSuccess from '../../../src/modules/subscriptions/payment-success';
import { sepay } from '../../../src/modules/subscriptions/sepay-checkout';
import { PaymentStatus } from '../../../src/utils/enums/payment-status.enum';
import { ERRORS } from '../../../src/utils/errors/errors';

describe('settlePendingPayment', () => {
  const manager = { update: jest.fn() } as unknown as EntityManager;
  const dataSource = {
    transaction: jest.fn((run: (m: EntityManager) => unknown) => run(manager)),
  } as unknown as DataSource;
  const payment = { id: 'pay-1', orderCode: 'BSABCD1234' };

  const found = (orderStatus: string) => ({
    data: { data: { order_status: orderStatus } },
  });
  const httpError = (status: number) =>
    Object.assign(new Error('http'), { response: { status } });

  let retrieve: jest.SpyInstance;
  let cancel: jest.SpyInstance;
  let confirm: jest.SpyInstance;
  let lock: jest.SpyInstance;
  let resign: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    retrieve = jest.spyOn(sepay.order, 'retrieve');
    cancel = jest.spyOn(sepay.order, 'cancel').mockResolvedValue({} as never);
    confirm = jest
      .spyOn(paymentSuccess, 'confirmPaymentSuccess')
      .mockResolvedValue(true);
    lock = jest.spyOn(paymentSuccess, 'lockPayment').mockResolvedValue({
      payment: { id: 'pay-1', status: PaymentStatus.PENDING },
      publisher: null,
    } as never);
    resign = jest
      .spyOn(paymentSuccess, 'resignPayments')
      .mockResolvedValue(undefined);
  });

  it('confirms an order SePay already captured, without cancelling it', async () => {
    retrieve.mockResolvedValue(found('CAPTURED'));
    const onConfirmed = jest.fn();

    await expect(
      settlePendingPayment(dataSource, payment, onConfirmed),
    ).resolves.toBe(PaymentStatus.SUCCESS);
    expect(confirm).toHaveBeenCalledWith(manager, 'pay-1');
    expect(cancel).not.toHaveBeenCalled();
    expect(onConfirmed).toHaveBeenCalledWith('pay-1');
  });

  it('does not report a confirmation when the order was already settled (IPN first)', async () => {
    retrieve.mockResolvedValue(found('CAPTURED'));
    confirm.mockResolvedValue(false);
    const onConfirmed = jest.fn();

    await expect(
      settlePendingPayment(dataSource, payment, onConfirmed),
    ).resolves.toBe(PaymentStatus.SUCCESS);
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it('cancels an unpaid order on SePay, then marks it failed and re-signs', async () => {
    retrieve.mockResolvedValue(found('AUTHENTICATION_NOT_NEEDED'));

    await expect(settlePendingPayment(dataSource, payment)).resolves.toBe(
      PaymentStatus.FAILED,
    );
    expect(cancel).toHaveBeenCalledWith('BSABCD1234');
    expect(lock).toHaveBeenCalledWith(manager, { id: 'pay-1' });
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), 'pay-1', {
      status: PaymentStatus.FAILED,
    });
    expect(resign).toHaveBeenCalledWith(manager, ['pay-1']);
  });

  it.each([
    ['SePay has no order yet', httpError(404)],
    ['the SePay order is already cancelled', found('CANCELLED')],
  ])('only marks failed when %s', async (_, result) => {
    if (result instanceof Error) {
      retrieve.mockRejectedValue(result);
    } else {
      retrieve.mockResolvedValue(result);
    }

    await expect(settlePendingPayment(dataSource, payment)).resolves.toBe(
      PaymentStatus.FAILED,
    );
    expect(cancel).not.toHaveBeenCalled();
    expect(manager.update).toHaveBeenCalled();
  });

  it.each([
    ['retrieve fails', () => retrieve.mockRejectedValue(httpError(500))],
    [
      'cancel fails',
      () => {
        retrieve.mockResolvedValue(found('AUTHENTICATION_NOT_NEEDED'));
        cancel.mockRejectedValue(httpError(500));
      },
    ],
  ])('throws 503 and keeps the order pending when %s', async (_, arrange) => {
    arrange();

    await expect(
      settlePendingPayment(dataSource, payment),
    ).rejects.toMatchObject({ code: ERRORS.SERVICE_UNAVAILABLE.code });
    expect(manager.update).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it.each([
    [PaymentStatus.SUCCESS, PaymentStatus.SUCCESS],
    [PaymentStatus.FAILED, PaymentStatus.FAILED],
  ])(
    'does not overwrite an order settled meanwhile (%s)',
    async (current, expected) => {
      retrieve.mockRejectedValue(httpError(404));
      lock.mockResolvedValue({
        payment: { id: 'pay-1', status: current },
        publisher: null,
      });

      await expect(settlePendingPayment(dataSource, payment)).resolves.toBe(
        expected,
      );
      expect(manager.update).not.toHaveBeenCalled();
    },
  );
});
