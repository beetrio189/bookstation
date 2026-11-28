import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { env } from '../../config';
import { PaymentStatus } from '../../utils/enums/payment-status.enum';
import { AppException } from '../../utils/errors/app.exception';
import { ERRORS } from '../../utils/errors/errors';
import { MailQueueService } from '../mail/mail-queue.service';
import { Publisher } from './entities/publisher.entity';
import { Payment } from '../subscriptions/entities/payment.entity';
import { loadPurchase } from '../subscriptions/payment-quote';
import { settlePendingPayment } from '../subscriptions/payment-settle';
import { durationMonthsSql } from '../subscriptions/plan-query';
import {
  confirmPaymentSuccess,
  PENDING_PAYMENT_TTL_MINUTES,
  resignPayments,
} from '../subscriptions/payment-success';
import {
  buildCheckoutForm,
  generateOrderCode,
  type SepayCheckoutForm,
} from '../subscriptions/sepay-checkout';

export type CreatePaymentResult =
  | { id: string; status: PaymentStatus.SUCCESS }
  | { id: string; checkout: SepayCheckoutForm };

interface PendingPayment {
  id: string;
  orderCode: string;
  planName: string;
  durationMonths: number;
  total: number;
  createdAt: Date;
  expiresAt: Date;
}

export interface PaymentDetail {
  id: string;
  orderCode: string;
  status: PaymentStatus;
  planName: string;
  durationMonths: number;
  price: number;
  creditUsed: number;
  total: number;
  createdAt: Date;
  expiresAt: Date | null;
  periodStartsAt: Date | null;
  periodEndsAt: Date | null;
}

@Injectable()
export class PublisherPaymentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly mailQueueService: MailQueueService,
  ) {}

  /**
   * Một đơn của NXB mà user này là chủ, cho trang kết quả sau khi SePay chuyển về.
   * Đơn của NXB khác cũng trả 404 để không dò được id đơn của nhau.
   */
  async findOne(userId: string, id: string): Promise<PaymentDetail> {
    const detail = await this.detailQuery(userId)
      .andWhere('pm.id = :id', { id })
      .getRawOne<PaymentDetail>();

    if (!detail) {
      throw new AppException(ERRORS.NOT_FOUND);
    }

    return detail;
  }

  /**
   * Đơn pending mới nhất (kể cả đã quá 15 phút mà job chưa quét, vì POST cũng bị
   * chính đơn đó chặn) để FE hiện "Tiếp tục thanh toán / Hủy". Không có thì `{}`.
   */
  async findPending(userId: string): Promise<{ payment?: PaymentDetail }> {
    const payment = await this.detailQuery(userId)
      .andWhere('pm.status = :pending')
      .orderBy('pm.created_at', 'DESC')
      .limit(1)
      .getRawOne<PaymentDetail>();

    return payment ? { payment } : {};
  }

  /** Cột trả về chung của GET /:id và GET /pending, chỉ đơn của NXB người gọi */
  private detailQuery(userId: string) {
    return this.dataSource.manager
      .createQueryBuilder(Payment, 'pm')
      .innerJoin(Publisher, 'p', 'p.id = pm.publisher_id')
      .select('pm.id', 'id')
      .addSelect('pm.order_code', 'orderCode')
      .addSelect('pm.status', 'status')
      .addSelect('pm.plan_name', 'planName')
      .addSelect(durationMonthsSql('pm.duration'), 'durationMonths')
      .addSelect('pm.price', 'price')
      .addSelect('pm.credit_used', 'creditUsed')
      .addSelect('pm.price - pm.credit_used', 'total')
      .addSelect('pm.created_at', 'createdAt')
      .addSelect(
        `CASE WHEN pm.status = :pending
              THEN pm.created_at + make_interval(mins => :ttl) END`,
        'expiresAt',
      )
      .addSelect('pm.period_starts_at', 'periodStartsAt')
      .addSelect('pm.period_ends_at', 'periodEndsAt')
      .where('p.user_id = :userId', { userId })
      .setParameters({
        pending: PaymentStatus.PENDING,
        ttl: PENDING_PAYMENT_TTL_MINUTES,
      });
  }

  /**
   * Tạo đơn mua gói cho chủ NXB (userId). Không đụng vào đơn cũ: còn đơn pending
   * (kể cả đã quá hạn mà job chưa quét) thì trả PENDING_PAYMENT_EXISTS.
   * total = 0: đơn "CR…" thành công ngay. total > 0: đơn "BS…" pending và form
   * SePay đã ký để FE tự gửi. Không gọi SePay nên transaction không chờ bên ngoài.
   */
  async create(userId: string, planId: string): Promise<CreatePaymentResult> {
    const created = await this.dataSource.transaction(async (manager) => {
      const me = await manager.findOne(Publisher, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!me) {
        throw new AppException(ERRORS.NOT_FOUND);
      }

      const pending = await manager
        .createQueryBuilder(Payment, 'pm')
        .select('pm.id', 'id')
        .addSelect('pm.order_code', 'orderCode')
        .addSelect('pm.plan_name', 'planName')
        .addSelect(durationMonthsSql('pm.duration'), 'durationMonths')
        .addSelect('pm.price - pm.credit_used', 'total')
        .addSelect('pm.created_at', 'createdAt')
        .addSelect('pm.created_at + make_interval(mins => :ttl)', 'expiresAt')
        .where('pm.publisher_id = :publisherId', { publisherId: me.id })
        .andWhere('pm.status = :status', { status: PaymentStatus.PENDING })
        .setParameter('ttl', PENDING_PAYMENT_TTL_MINUTES)
        .orderBy('pm.created_at', 'DESC')
        .limit(1)
        .getRawOne<PendingPayment>();

      if (pending) {
        throw new AppException(ERRORS.PENDING_PAYMENT_EXISTS, undefined, {
          payment: pending,
        });
      }

      const { publisherName, plan, quote } = await loadPurchase(
        manager,
        userId,
        planId,
      );
      const isCreditOnly = quote.total === 0;
      const orderCode = generateOrderCode(isCreditOnly ? 'CR' : 'BS');

      const { id } = await manager.save(Payment, {
        publisherId: me.id,
        planId: plan.id,
        publisherName,
        planName: plan.name,
        duration: plan.duration,
        bookLimit: plan.bookLimit,
        editorLimit: plan.editorLimit,
        featuredWeight: plan.featuredWeight,
        price: quote.price,
        creditUsed: quote.creditUsed,
        orderCode,
        status: PaymentStatus.PENDING,
      });

      if (isCreditOnly) {
        await confirmPaymentSuccess(manager, id);
      } else {
        await resignPayments(manager, [id]);
      }

      return {
        id,
        orderCode,
        isCreditOnly,
        total: quote.total,
        planName: plan.name,
        durationMonths: plan.durationMonths,
      };
    });

    if (created.isCreditOnly) {
      await this.mailQueueService.enqueuePaymentReceipt(created.id);
      return { id: created.id, status: PaymentStatus.SUCCESS };
    }

    return { id: created.id, checkout: this.checkoutForm(created) };
  }

  /**
   * "Tiếp tục thanh toán": dựng lại đúng form SePay của đơn pending (cùng mã, số
   * tiền, URL nên chữ ký giống hệt lần đầu). Không ghi DB, không gọi SePay.
   */
  async checkout(
    userId: string,
    id: string,
  ): Promise<{ checkout: SepayCheckoutForm }> {
    const payment = await this.findOne(userId, id);

    if (payment.status !== PaymentStatus.PENDING) {
      throw new AppException(ERRORS.PAYMENT_NOT_PENDING);
    }

    if (payment.expiresAt && new Date(payment.expiresAt) <= new Date()) {
      throw new AppException(ERRORS.PAYMENT_EXPIRED);
    }

    return { checkout: this.checkoutForm(payment) };
  }

  /**
   * Hủy đơn pending (kể cả đã quá 15 phút). Hỏi SePay trước: đã nhận tiền thì
   * xác nhận thành công và báo PAYMENT_ALREADY_PAID thay vì hủy.
   */
  async cancel(userId: string, id: string): Promise<Record<string, never>> {
    const payment = await this.findOne(userId, id);

    if (payment.status === PaymentStatus.SUCCESS) {
      throw new AppException(ERRORS.PAYMENT_ALREADY_PAID);
    }

    if (payment.status === PaymentStatus.FAILED) {
      throw new AppException(ERRORS.PAYMENT_NOT_PENDING);
    }

    const status = await settlePendingPayment(this.dataSource, payment, (id) =>
      this.mailQueueService.enqueuePaymentReceipt(id),
    );

    if (status === PaymentStatus.SUCCESS) {
      throw new AppException(ERRORS.PAYMENT_ALREADY_PAID);
    }

    return {};
  }

  /** Form SePay của một đơn; tạo đơn và tiếp tục thanh toán dùng chung để ra cùng form */
  private checkoutForm(
    payment: Pick<
      PaymentDetail,
      'id' | 'orderCode' | 'total' | 'planName' | 'durationMonths'
    >,
  ): SepayCheckoutForm {
    const resultUrl = (result: 'success' | 'error' | 'cancel') =>
      `${env.feUrl}/publisher/payments/${payment.id}?result=${result}`;

    return buildCheckoutForm({
      orderCode: payment.orderCode,
      amount: payment.total,
      description: `BookStation - Gói ${payment.planName} ${payment.durationMonths} tháng - ${payment.orderCode}`,
      successUrl: resultUrl('success'),
      errorUrl: resultUrl('error'),
      cancelUrl: resultUrl('cancel'),
    });
  }
}
