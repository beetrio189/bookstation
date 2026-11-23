import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MailService, type PaymentReceipt } from '../modules/mail/mail.service';
import { durationMonthsSql } from '../modules/subscriptions/plan-query';
import { PaymentStatus } from '../utils/enums/payment-status.enum';

interface ReceiptRow extends PaymentReceipt {
  email: string;
}

/**
 * Job PAYMENT_RECEIPT: đọc lại đơn đã thành công từ DB (payload chỉ có id) rồi gửi
 * biên nhận cho chủ NXB. Gói cũ bị cắt ngang = đơn success cùng NXB có
 * period_ends_at đúng bằng period_starts_at của đơn này (cùng now() trong transaction).
 */
@Injectable()
export class PaymentReceiptService {
  private readonly logger = new Logger(PaymentReceiptService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
  ) {}

  async send(paymentId: string): Promise<void> {
    const [receipt] = await this.dataSource.query<ReceiptRow[]>(
      `SELECT u.notification_email AS email,
              pm.order_code AS "orderCode",
              pm.publisher_name AS "publisherName",
              pm.plan_name AS "planName",
              ${durationMonthsSql('pm.duration')} AS "durationMonths",
              pm.book_limit AS "bookLimit",
              pm.editor_limit AS "editorLimit",
              pm.price,
              pm.credit_used AS "creditUsed",
              pm.period_starts_at AS "periodStartsAt",
              pm.period_ends_at AS "periodEndsAt",
              old.plan_name AS "oldPlanName",
              old.duration_months AS "oldDurationMonths",
              old.credit_returned AS "creditReturned"
       FROM payments pm
       JOIN publishers p ON p.id = pm.publisher_id
       JOIN users u ON u.id = p.user_id
       LEFT JOIN LATERAL (
         SELECT o.plan_name, ${durationMonthsSql('o.duration')} AS duration_months,
                o.credit_returned
         FROM payments o
         WHERE o.publisher_id = pm.publisher_id
           AND o.id <> pm.id
           AND o.status = $2
           AND o.period_ends_at = pm.period_starts_at
         LIMIT 1
       ) old ON true
       WHERE pm.id = $1 AND pm.status = $2`,
      [paymentId, PaymentStatus.SUCCESS],
    );

    if (!receipt) {
      this.logger.warn(`Bỏ biên nhận đơn ${paymentId}: không có đơn / NXB`);
      return;
    }

    const { email, ...data } = receipt;

    await this.mailService.sendPaymentReceiptEmail(email, data);
  }
}
