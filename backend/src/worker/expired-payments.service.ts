import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { DataSource, In, Raw } from 'typeorm';
import { MailQueueService } from '../modules/mail/mail-queue.service';
import { REDIS_CLIENT } from '../modules/redis/redis.module';
import { Payment } from '../modules/subscriptions/entities/payment.entity';
import { settlePendingPayment } from '../modules/subscriptions/payment-settle';
import { PENDING_PAYMENT_TTL_MINUTES } from '../modules/subscriptions/payment-success';
import { User } from '../modules/users/entities/user.entity';
import { PaymentStatus } from '../utils/enums/payment-status.enum';
import { RoleCode } from '../utils/enums/role-code.enum';

export const SETTLE_BATCH_SIZE = 50;
export const SETTLE_ALERT_AFTER_RUNS = 10;
export const SETTLE_FAILURES_KEY = 'payments:settle:failures';

const overdue = {
  status: PaymentStatus.PENDING,
  createdAt: Raw(
    (column) => `${column} <= now() - make_interval(mins => :ttl)`,
    {
      ttl: PENDING_PAYMENT_TTL_MINUTES,
    },
  ),
};

/** Mô tả ngắn lỗi SePay (lỗi gốc nằm trong cause của AppException 503) */
const describeError = (error: unknown) =>
  String((error as Error).cause ?? error);

/**
 * Job mỗi phút: chốt các đơn pending đã quá 15 phút bằng settlePendingPayment
 * (cùng hàm với API hủy). Gọi SePay lần lượt từng đơn; đơn lỗi thì bỏ qua, lượt
 * sau quét lại. Lỗi SETTLE_ALERT_AFTER_RUNS lượt liên tiếp thì mail admin + KDV,
 * mỗi đợt lỗi một lần.
 */
@Injectable()
export class ExpiredPaymentsService {
  private readonly logger = new Logger(ExpiredPaymentsService.name);

  constructor(
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly mailQueueService: MailQueueService,
  ) {}

  async settleExpired(): Promise<void> {
    const payments = await this.dataSource.manager.find(Payment, {
      select: { id: true, orderCode: true },
      where: overdue,
      order: { createdAt: 'ASC' },
      take: SETTLE_BATCH_SIZE,
    });

    if (payments.length === 0) {
      return;
    }

    let succeeded = 0;
    let failed = 0;
    let lastError = '';

    for (const payment of payments) {
      try {
        const status = await settlePendingPayment(
          this.dataSource,
          payment,
          (id) => this.mailQueueService.enqueuePaymentReceipt(id),
        );

        if (status === PaymentStatus.SUCCESS) {
          succeeded++;
        } else {
          failed++;
        }
      } catch (error) {
        lastError = describeError(error);
        this.logger.warn(
          `Chưa chốt được đơn ${payment.orderCode}: ${lastError}`,
        );
      }
    }

    const errors = payments.length - succeeded - failed;

    this.logger.log(
      `Đã chốt ${payments.length} đơn: ${succeeded} thành công, ${failed} failed, ${errors} lỗi`,
    );

    if (succeeded + failed > 0) {
      await this.redis.del(SETTLE_FAILURES_KEY);
      return;
    }

    await this.recordFailedRun(lastError);
  }

  private async recordFailedRun(lastError: string): Promise<void> {
    const streak = await this.redis.hincrby(SETTLE_FAILURES_KEY, 'streak', 1);

    if (streak === 1) {
      await this.redis.hset(
        SETTLE_FAILURES_KEY,
        'since',
        new Date().toISOString(),
      );
    }

    if (streak !== SETTLE_ALERT_AFTER_RUNS) {
      return;
    }

    const since = await this.redis.hget(SETTLE_FAILURES_KEY, 'since');
    const overdueCount = await this.dataSource.manager.count(Payment, {
      where: overdue,
    });
    const recipients = await this.dataSource.manager.find(User, {
      select: { id: true, notificationEmail: true },
      where: { role: In([RoleCode.ADMIN, RoleCode.MODERATOR]) },
    });

    await this.mailQueueService.enqueuePaymentSettleAlerts(
      recipients.map(({ id, notificationEmail }) => ({
        userId: id,
        email: notificationEmail,
        failingSince: since ?? new Date().toISOString(),
        failedRuns: streak,
        overdueCount,
        lastError,
      })),
    );

    this.logger.warn(
      `Job chốt đơn lỗi ${streak} lượt liên tiếp, đã mail ${recipients.length} admin / KDV`,
    );
  }
}
