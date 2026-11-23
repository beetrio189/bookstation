import { timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { env } from '../../config';
import { PaymentStatus } from '../../utils/enums/payment-status.enum';
import { AppException } from '../../utils/errors/app.exception';
import { ERRORS } from '../../utils/errors/errors';
import { MailQueueService } from '../mail/mail-queue.service';
import { confirmPaymentSuccess, lockPayment } from './payment-success';

/** Phần body IPN SePay cần dùng, https://developer.sepay.vn/vi/cong-thanh-toan/IPN */
export interface SepayIpnBody {
  notification_type?: unknown;
  order?: {
    order_status?: unknown;
    order_amount?: unknown;
    order_invoice_number?: unknown;
  };
}

@Injectable()
export class SepayIpnService {
  private readonly logger = new Logger(SepayIpnService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly mailQueueService: MailQueueService,
  ) {}

  /**
   * SePay báo đơn đã trả tiền. Chỉ cần HTTP 200 là SePay coi như đã nhận, nên mọi
   * ca không xác nhận được (không thấy đơn, đơn failed, lệch tiền, gửi trùng) đều
   * ghi log rồi trả bình thường; chỉ sai secret mới trả 401.
   */
  async handle(secretKey: string | undefined, body: SepayIpnBody) {
    const actual = Buffer.from(secretKey ?? '');
    const expected = Buffer.from(env.sepayIpnSecret);

    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new AppException(ERRORS.UNAUTHENTICATED);

    const order = body?.order;
    const orderCode = order?.order_invoice_number;

    if (
      body?.notification_type !== 'ORDER_PAID' ||
      order?.order_status !== 'CAPTURED' ||
      typeof orderCode !== 'string'
    ) {
      return { success: true };
    }

    const confirmedId = await this.dataSource.transaction(async (manager) => {
      const { payment, publisher } = await lockPayment(manager, { orderCode });

      if (!payment) {
        this.logger.warn(`IPN ${orderCode}: không có đơn`);
        return null;
      }

      if (payment.status === PaymentStatus.SUCCESS) {
        return null;
      }

      const paid = Number(order?.order_amount);

      if (payment.status === PaymentStatus.FAILED) {
        this.logger.warn(
          `IPN ${orderCode}: tiền về cho đơn đã failed (${paid} đ), cần xử lý tay`,
        );
        return null;
      }

      const total = payment.price - payment.creditUsed;

      if (paid !== total) {
        this.logger.warn(
          `IPN ${orderCode}: số tiền ${String(order?.order_amount)} khác ${total} đ, không xác nhận`,
        );
        return null;
      }

      await confirmPaymentSuccess(manager, payment.id);

      if (publisher) {
        this.logger.log(`IPN ${orderCode}: thành công ${paid} đ`);
      } else {
        this.logger.warn(
          `IPN ${orderCode}: thành công ${paid} đ nhưng NXB "${payment.publisherName}" đã bị xóa`,
        );
      }

      return payment.id;
    });

    if (confirmedId) {
      await this.mailQueueService.enqueuePaymentReceipt(confirmedId);
    }

    return { success: true };
  }
}
