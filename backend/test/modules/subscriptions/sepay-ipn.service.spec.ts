import { DataSource, EntityManager } from 'typeorm';
import { MailQueueService } from '../../../src/modules/mail/mail-queue.service';
import * as paymentSuccess from '../../../src/modules/subscriptions/payment-success';
import { SepayIpnService } from '../../../src/modules/subscriptions/sepay-ipn.service';
import { PaymentStatus } from '../../../src/utils/enums/payment-status.enum';
import { ERRORS } from '../../../src/utils/errors/errors';

describe('SepayIpnService', () => {
  const manager = {} as EntityManager;
  const dataSource = {
    transaction: jest.fn((run: (m: EntityManager) => unknown) => run(manager)),
  } as unknown as DataSource;
  const mailQueueService = { enqueuePaymentReceipt: jest.fn() };
  const service = new SepayIpnService(
    dataSource,
    mailQueueService as unknown as MailQueueService,
  );
  const secret = 'test-sepay-ipn-secret';

  const body = (amount = '450000.00') => ({
    notification_type: 'ORDER_PAID',
    order: {
      order_status: 'CAPTURED',
      order_amount: amount,
      order_invoice_number: 'BSABCD1234',
    },
  });
  const payment = (status = PaymentStatus.PENDING) => ({
    id: 'pay-1',
    status,
    price: 600000,
    creditUsed: 150000,
    publisherName: 'NXB Kim Đồng',
  });

  let lock: jest.SpyInstance;
  let confirm: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    lock = jest.spyOn(paymentSuccess, 'lockPayment').mockResolvedValue({
      payment: payment(),
      publisher: { id: 'pub-1' },
    } as never);
    confirm = jest
      .spyOn(paymentSuccess, 'confirmPaymentSuccess')
      .mockResolvedValue(true);
  });

  it.each([undefined, 'wrong', 'x'.repeat(500)])(
    'rejects secret %p with 401 without touching the DB',
    async (key) => {
      await expect(service.handle(key, body())).rejects.toMatchObject({
        code: ERRORS.UNAUTHENTICATED.code,
      });
      expect(dataSource.transaction).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      'another notification',
      { ...body(), notification_type: 'TRANSACTION_VOID' },
    ],
    [
      'an uncaptured order',
      { ...body(), order: { ...body().order, order_status: 'PENDING' } },
    ],
    [
      'a non-string order code',
      { ...body(), order: { ...body().order, order_invoice_number: { a: 1 } } },
    ],
  ])('ignores %s', async (_, ipn) => {
    await expect(service.handle(secret, ipn)).resolves.toEqual({
      success: true,
    });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it.each(['450000.00', '450000'])(
    'confirms a pending order paid in full (%s)',
    async (amount) => {
      await expect(service.handle(secret, body(amount))).resolves.toEqual({
        success: true,
      });
      expect(lock).toHaveBeenCalledWith(manager, { orderCode: 'BSABCD1234' });
      expect(confirm).toHaveBeenCalledWith(manager, 'pay-1');
      // Biên nhận đẩy sau khi transaction xác nhận đã commit
      expect(mailQueueService.enqueuePaymentReceipt).toHaveBeenCalledWith(
        'pay-1',
      );
    },
  );

  it('confirms even when the publisher was deleted', async () => {
    lock.mockResolvedValue({ payment: payment(), publisher: null });

    await service.handle(secret, body());

    expect(confirm).toHaveBeenCalledWith(manager, 'pay-1');
  });

  it.each([
    ['unknown order', { payment: null, publisher: null }, body()],
    ['duplicate IPN', { payment: payment(PaymentStatus.SUCCESS) }, body()],
    ['failed order', { payment: payment(PaymentStatus.FAILED) }, body()],
    ['wrong amount', { payment: payment() }, body('450001')],
    ['malformed amount', { payment: payment() }, body('450,000')],
  ])('answers 200 but does not confirm: %s', async (_, locked, ipn) => {
    lock.mockResolvedValue(locked);

    await expect(service.handle(secret, ipn)).resolves.toEqual({
      success: true,
    });
    expect(confirm).not.toHaveBeenCalled();
    expect(mailQueueService.enqueuePaymentReceipt).not.toHaveBeenCalled();
  });
});
