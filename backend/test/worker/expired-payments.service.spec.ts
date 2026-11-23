import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { MailQueueService } from '../../src/modules/mail/mail-queue.service';
import * as paymentSettle from '../../src/modules/subscriptions/payment-settle';
import { PaymentStatus } from '../../src/utils/enums/payment-status.enum';
import { AppException } from '../../src/utils/errors/app.exception';
import { ERRORS } from '../../src/utils/errors/errors';
import {
  ExpiredPaymentsService,
  SETTLE_ALERT_AFTER_RUNS,
  SETTLE_BATCH_SIZE,
  SETTLE_FAILURES_KEY,
} from '../../src/worker/expired-payments.service';

describe('ExpiredPaymentsService', () => {
  const manager = { find: jest.fn(), count: jest.fn() };
  const dataSource = { manager } as unknown as DataSource;
  const redis = {
    del: jest.fn(),
    hincrby: jest.fn(),
    hset: jest.fn(),
    hget: jest.fn(),
  };
  const mailQueueService = { enqueuePaymentSettleAlerts: jest.fn() };
  const service = new ExpiredPaymentsService(
    dataSource,
    redis as unknown as Redis,
    mailQueueService as unknown as MailQueueService,
  );

  const orders = [
    { id: 'pay-1', orderCode: 'BSAAAA1111' },
    { id: 'pay-2', orderCode: 'BSBBBB2222' },
  ];
  const sepayDown = new AppException(
    ERRORS.SERVICE_UNAVAILABLE,
    undefined,
    undefined,
    new Error('Request failed with status code 500'),
  );

  let settle: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    settle = jest.spyOn(paymentSettle, 'settlePendingPayment');
  });

  // Số lượt lỗi liên tiếp sau khi hincrby tăng
  const failedRun = (streak: number) => redis.hincrby.mockResolvedValue(streak);

  it('reads the oldest overdue pending orders, at most one batch', async () => {
    manager.find.mockResolvedValue([]);

    await service.settleExpired();

    expect(manager.find).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        order: { createdAt: 'ASC' },
        take: SETTLE_BATCH_SIZE,
        where: expect.objectContaining({
          status: PaymentStatus.PENDING,
        }) as object,
      }),
    );
    expect(settle).not.toHaveBeenCalled();
    // Không gọi SePay nên không biết SePay sống hay chết: giữ nguyên bộ đếm
    expect(redis.del).not.toHaveBeenCalled();
    expect(redis.hincrby).not.toHaveBeenCalled();
  });

  it('settles orders one by one, skips a failing one and resets the failure streak', async () => {
    manager.find.mockResolvedValue(orders);
    settle
      .mockRejectedValueOnce(sepayDown)
      .mockResolvedValueOnce(PaymentStatus.FAILED);

    await service.settleExpired();

    expect(settle).toHaveBeenNthCalledWith(
      1,
      dataSource,
      orders[0],
      expect.any(Function),
    );
    expect(settle).toHaveBeenNthCalledWith(
      2,
      dataSource,
      orders[1],
      expect.any(Function),
    );
    expect(redis.del).toHaveBeenCalledWith(SETTLE_FAILURES_KEY);
    expect(redis.hincrby).not.toHaveBeenCalled();
  });

  it('counts a run where no order could be settled, without mailing below the threshold', async () => {
    manager.find.mockResolvedValue(orders);
    settle.mockRejectedValue(sepayDown);
    failedRun(1);

    await service.settleExpired();

    expect(redis.hincrby).toHaveBeenCalledWith(
      SETTLE_FAILURES_KEY,
      'streak',
      1,
    );
    // Lượt lỗi đầu của đợt: ghi thời điểm bắt đầu
    expect(redis.hset).toHaveBeenCalledWith(
      SETTLE_FAILURES_KEY,
      'since',
      expect.any(String),
    );
    expect(redis.del).not.toHaveBeenCalled();
    expect(mailQueueService.enqueuePaymentSettleAlerts).not.toHaveBeenCalled();
  });

  it('mails every admin and moderator once the streak reaches the threshold', async () => {
    manager.find.mockResolvedValueOnce(orders).mockResolvedValueOnce([
      { id: 'admin-1', notificationEmail: 'admin@example.com' },
      { id: 'mod-1', notificationEmail: 'mod@example.com' },
    ]);
    manager.count.mockResolvedValue(7);
    settle.mockRejectedValue(sepayDown);
    failedRun(SETTLE_ALERT_AFTER_RUNS);
    redis.hget.mockResolvedValue('2026-11-23T03:00:00.000Z');

    await service.settleExpired();

    // Không phải lượt đầu: giữ nguyên thời điểm bắt đầu
    expect(redis.hset).not.toHaveBeenCalled();
    expect(mailQueueService.enqueuePaymentSettleAlerts).toHaveBeenCalledWith([
      {
        userId: 'admin-1',
        email: 'admin@example.com',
        failingSince: '2026-11-23T03:00:00.000Z',
        failedRuns: SETTLE_ALERT_AFTER_RUNS,
        overdueCount: 7,
        lastError: 'Error: Request failed with status code 500',
      },
      expect.objectContaining({ userId: 'mod-1', email: 'mod@example.com' }),
    ]);
  });

  it('does not mail again in the same failure streak', async () => {
    manager.find.mockResolvedValue(orders);
    settle.mockRejectedValue(sepayDown);
    failedRun(SETTLE_ALERT_AFTER_RUNS + 1);

    await service.settleExpired();

    expect(mailQueueService.enqueuePaymentSettleAlerts).not.toHaveBeenCalled();
  });
});
