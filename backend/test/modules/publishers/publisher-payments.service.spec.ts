import { DataSource, EntityManager } from 'typeorm';
import { MailQueueService } from '../../../src/modules/mail/mail-queue.service';
import { PublisherPaymentsService } from '../../../src/modules/publishers/publisher-payments.service';
import * as paymentQuote from '../../../src/modules/subscriptions/payment-quote';
import * as paymentSettle from '../../../src/modules/subscriptions/payment-settle';
import * as paymentSuccess from '../../../src/modules/subscriptions/payment-success';
import { PaymentStatus } from '../../../src/utils/enums/payment-status.enum';
import { ERRORS } from '../../../src/utils/errors/errors';

describe('PublisherPaymentsService', () => {
  const queryBuilder = { getRawOne: jest.fn() } as Record<string, jest.Mock>;
  for (const method of [
    'select',
    'addSelect',
    'where',
    'andWhere',
    'setParameter',
    'setParameters',
    'innerJoin',
    'orderBy',
    'limit',
  ]) {
    queryBuilder[method] = jest.fn(() => queryBuilder);
  }
  const manager = {
    findOne: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };
  const dataSource = {
    manager,
    transaction: jest.fn((run: (m: EntityManager) => unknown) =>
      run(manager as unknown as EntityManager),
    ),
  } as unknown as DataSource;
  const mailQueueService = { enqueuePaymentReceipt: jest.fn() };
  const service = new PublisherPaymentsService(
    dataSource,
    mailQueueService as unknown as MailQueueService,
  );

  const purchase = (total: number): paymentQuote.PurchaseContext => ({
    publisherId: 'pub-1',
    publisherName: 'NXB Kim Đồng',
    plan: {
      id: 'plan-1',
      name: 'Pro',
      duration: '6 mons',
      durationMonths: 6,
      bookLimit: 500,
      editorLimit: 10,
    },
    quote: {
      price: 600000,
      creditBalance: 0,
      creditReturned: 600000 - total,
      creditUsed: 600000 - total,
      total,
    },
  });

  let loadPurchase: jest.SpyInstance;
  let confirm: jest.SpyInstance;
  let resign: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    manager.findOne.mockResolvedValue({ id: 'pub-1' });
    manager.save.mockResolvedValue({ id: 'pay-new' });
    queryBuilder.getRawOne.mockResolvedValue(undefined);
    loadPurchase = jest.spyOn(paymentQuote, 'loadPurchase');
    confirm = jest
      .spyOn(paymentSuccess, 'confirmPaymentSuccess')
      .mockResolvedValue(true);
    resign = jest
      .spyOn(paymentSuccess, 'resignPayments')
      .mockResolvedValue(undefined);
  });

  it('locks the publisher row of the caller', async () => {
    loadPurchase.mockResolvedValue(purchase(0));

    await service.create('user-1', 'plan-1');

    expect(manager.findOne).toHaveBeenCalledWith(expect.anything(), {
      where: { userId: 'user-1' },
      lock: { mode: 'pessimistic_write' },
    });
  });

  it('rejects with the pending order when one exists, without touching it', async () => {
    const pending = { id: 'pay-old', orderCode: 'BSAAAA1111' };
    queryBuilder.getRawOne.mockResolvedValue(pending);

    await expect(service.create('user-1', 'plan-1')).rejects.toMatchObject({
      code: ERRORS.PENDING_PAYMENT_EXISTS.code,
      details: { payment: pending },
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('pm.status = :status', {
      status: PaymentStatus.PENDING,
    });
    expect(loadPurchase).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('confirms a credit-only order (CR…) right away', async () => {
    loadPurchase.mockResolvedValue(purchase(0));

    await expect(service.create('user-1', 'plan-1')).resolves.toEqual({
      id: 'pay-new',
      status: PaymentStatus.SUCCESS,
    });

    expect(manager.save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        orderCode: expect.stringMatching(/^CR[0-9A-Z]{8}$/) as string,
        creditUsed: 600000,
        status: PaymentStatus.PENDING,
      }),
    );
    expect(confirm).toHaveBeenCalledWith(manager, 'pay-new');
    expect(mailQueueService.enqueuePaymentReceipt).toHaveBeenCalledWith(
      'pay-new',
    );
  });

  it('creates a pending BS… order and returns a signed SePay form for the total', async () => {
    loadPurchase.mockResolvedValue(purchase(450000));

    const result = await service.create('user-1', 'plan-1');

    const [, values] = manager.save.mock.calls[0] as [
      unknown,
      { orderCode: string },
    ];
    expect(values.orderCode).toMatch(/^BS[0-9A-Z]{8}$/);
    expect(resign).toHaveBeenCalledWith(manager, ['pay-new']);
    expect(confirm).not.toHaveBeenCalled();
    expect(mailQueueService.enqueuePaymentReceipt).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: 'pay-new',
      checkout: {
        fields: {
          order_amount: '450000',
          order_invoice_number: values.orderCode,
        },
      },
    });
  });

  describe('findOne', () => {
    it('reads the order only through the caller publisher, 404 otherwise', async () => {
      const detail = { id: 'pay-1', status: PaymentStatus.FAILED };
      queryBuilder.getRawOne.mockResolvedValue(detail);

      await expect(service.findOne('user-1', 'pay-1')).resolves.toBe(detail);
      expect(queryBuilder.innerJoin).toHaveBeenCalledWith(
        expect.anything(),
        'p',
        'p.id = pm.publisher_id',
      );
      expect(queryBuilder.where).toHaveBeenCalledWith('p.user_id = :userId', {
        userId: 'user-1',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('pm.id = :id', {
        id: 'pay-1',
      });

      queryBuilder.getRawOne.mockResolvedValue(undefined);
      await expect(service.findOne('user-2', 'pay-1')).rejects.toMatchObject({
        code: ERRORS.NOT_FOUND.code,
      });
    });

    it('only gives expiresAt to pending orders', async () => {
      queryBuilder.getRawOne.mockResolvedValue({ id: 'pay-1' });

      await service.findOne('user-1', 'pay-1');

      expect(queryBuilder.addSelect).toHaveBeenCalledWith(
        expect.stringContaining('CASE WHEN pm.status = :pending'),
        'expiresAt',
      );
      expect(queryBuilder.setParameters).toHaveBeenCalledWith({
        pending: PaymentStatus.PENDING,
        ttl: 15,
      });
    });
  });

  describe('findPending', () => {
    it('returns the newest pending order of the caller publisher', async () => {
      const payment = { id: 'pay-1', status: PaymentStatus.PENDING };
      queryBuilder.getRawOne.mockResolvedValue(payment);

      await expect(service.findPending('user-1')).resolves.toEqual({ payment });
      expect(queryBuilder.where).toHaveBeenCalledWith('p.user_id = :userId', {
        userId: 'user-1',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'pm.status = :pending',
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'pm.created_at',
        'DESC',
      );
    });

    it('returns {} when there is no pending order', async () => {
      queryBuilder.getRawOne.mockResolvedValue(undefined);

      await expect(service.findPending('user-1')).resolves.toEqual({});
    });
  });

  describe('cancel', () => {
    let settle: jest.SpyInstance;

    beforeEach(() => {
      settle = jest.spyOn(paymentSettle, 'settlePendingPayment');
    });

    it('settles a pending order (even expired) and answers {} when it got cancelled', async () => {
      const row = {
        id: 'pay-1',
        orderCode: 'BSABCD1234',
        status: PaymentStatus.PENDING,
        expiresAt: new Date(Date.now() - 60_000),
      };
      queryBuilder.getRawOne.mockResolvedValue(row);
      settle.mockResolvedValue(PaymentStatus.FAILED);

      await expect(service.cancel('user-1', 'pay-1')).resolves.toEqual({});
      expect(settle).toHaveBeenCalledWith(
        dataSource,
        row,
        expect.any(Function),
      );
    });

    it('reports PAYMENT_ALREADY_PAID when SePay says it was paid', async () => {
      queryBuilder.getRawOne.mockResolvedValue({
        id: 'pay-1',
        status: PaymentStatus.PENDING,
      });
      settle.mockResolvedValue(PaymentStatus.SUCCESS);

      await expect(service.cancel('user-1', 'pay-1')).rejects.toMatchObject({
        code: ERRORS.PAYMENT_ALREADY_PAID.code,
      });
    });

    it.each([
      [PaymentStatus.SUCCESS, ERRORS.PAYMENT_ALREADY_PAID],
      [PaymentStatus.FAILED, ERRORS.PAYMENT_NOT_PENDING],
    ])('rejects a %s order without calling SePay', async (status, error) => {
      queryBuilder.getRawOne.mockResolvedValue({ id: 'pay-1', status });

      await expect(service.cancel('user-1', 'pay-1')).rejects.toMatchObject({
        code: error.code,
      });
      expect(settle).not.toHaveBeenCalled();
    });
  });

  describe('checkout', () => {
    const pending = {
      id: 'pay-1',
      orderCode: 'BSABCD1234',
      status: PaymentStatus.PENDING,
      planName: 'Pro',
      durationMonths: 6,
      total: 450000,
    };

    it('rebuilds the SePay form of a pending, unexpired order', async () => {
      queryBuilder.getRawOne.mockResolvedValue({
        ...pending,
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(service.checkout('user-1', 'pay-1')).resolves.toMatchObject({
        checkout: {
          fields: {
            order_amount: '450000',
            order_invoice_number: 'BSABCD1234',
            order_description: 'BookStation - Gói Pro 6 tháng - BSABCD1234',
          },
        },
      });
    });

    it.each([
      [
        'not pending',
        { ...pending, status: PaymentStatus.FAILED },
        ERRORS.PAYMENT_NOT_PENDING,
      ],
      [
        'expired',
        { ...pending, expiresAt: new Date(Date.now() - 1000) },
        ERRORS.PAYMENT_EXPIRED,
      ],
    ])('rejects when the order is %s', async (_, row, error) => {
      queryBuilder.getRawOne.mockResolvedValue(row);

      await expect(service.checkout('user-1', 'pay-1')).rejects.toMatchObject({
        code: error.code,
      });
    });
  });
});
