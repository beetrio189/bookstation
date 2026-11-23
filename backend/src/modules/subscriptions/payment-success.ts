import { EntityManager, In } from 'typeorm';
import { PaymentStatus } from '../../utils/enums/payment-status.enum';
import { Publisher } from '../publishers/entities/publisher.entity';
import { Payment } from './entities/payment.entity';
import { signPayment } from './payment-signature';
import { CREDIT_RETURNED_SQL } from './payment-quote';
import { ACTIVE_PERIOD } from './plan-subscribers';

export const PENDING_PAYMENT_TTL_MINUTES = 15;

/** Ký lại các đơn sau khi đổi cột tiền / kỳ (xem payment-signature.ts) */
export async function resignPayments(
  manager: EntityManager,
  ids: string[],
): Promise<void> {
  const payments = await manager.findBy(Payment, { id: In(ids) });

  for (const payment of payments) {
    await manager.update(Payment, payment.id, {
      signature: signPayment(payment),
    });
  }
}

/**
 * Khóa một đơn theo thứ tự chung của mọi luồng: publishers trước, payments sau
 * (giống POST /publisher/payments và xóa NXB) để không deadlock. publisher_id đọc
 * không khóa; NXB đã bị xóa thì publisher = null (FK SET NULL nên đơn cũng NULL).
 * Phải gọi trong transaction.
 */
export async function lockPayment(
  manager: EntityManager,
  where: { id: string } | { orderCode: string },
): Promise<{ payment: Payment | null; publisher: Publisher | null }> {
  const unlocked = await manager.findOne(Payment, { where });

  if (!unlocked) {
    return { payment: null, publisher: null };
  }

  const publisher = unlocked.publisherId
    ? await manager.findOne(Publisher, {
        where: { id: unlocked.publisherId },
        lock: { mode: 'pessimistic_write' },
      })
    : null;
  const payment = await manager.findOne(Payment, {
    where: { id: unlocked.id },
    lock: { mode: 'pessimistic_write' },
  });

  return { payment, publisher };
}

/**
 * Xác nhận đơn pending đã thanh toán xong. Phải gọi trong transaction. Dùng chung
 * cho: đơn trả hết bằng credit (POST /publisher/payments), IPN.
 * - Cắt kỳ đang chạy (nếu có) tại now(), ghi credit_returned = R tính lúc này.
 * - credit_balance += R − credit_used (không xuống dưới 0: R lúc này có thể nhỏ
 *   hơn lúc tạo đơn vài nghìn đồng, người dùng chấp nhận).
 * - Đơn này thành success, kỳ mới từ now() đến now() + duration; ký lại cả hai đơn.
 * Trả false khi đơn không còn pending (IPN gửi trùng, đã bị hủy) và không làm gì.
 */
export async function confirmPaymentSuccess(
  manager: EntityManager,
  paymentId: string,
): Promise<boolean> {
  const { payment, publisher } = await lockPayment(manager, { id: paymentId });

  if (payment?.status !== PaymentStatus.PENDING) {
    return false;
  }

  const signed = [paymentId];

  if (publisher) {
    const current = await manager
      .createQueryBuilder(Payment, 'pm')
      .select('pm.id', 'id')
      .addSelect(`COALESCE(${CREDIT_RETURNED_SQL}, 0)`, 'creditReturned')
      .where('pm.publisher_id = :publisherId', { publisherId: publisher.id })
      .andWhere(ACTIVE_PERIOD)
      .orderBy('pm.period_ends_at', 'DESC')
      .limit(1)
      .setLock('pessimistic_write')
      .getRawOne<Payment>();
    const creditReturned = current?.creditReturned ?? 0;

    if (current) {
      await manager.update(Payment, current.id, {
        periodEndsAt: () => 'now()',
        creditReturned,
      });
      signed.push(current.id);
    }

    await manager.update(Publisher, publisher.id, {
      creditBalance: Math.max(
        0,
        publisher.creditBalance + creditReturned - payment.creditUsed,
      ),
    });
  }

  await manager.update(Payment, paymentId, {
    status: PaymentStatus.SUCCESS,
    periodStartsAt: () => 'now()',
    periodEndsAt: () => 'now() + duration',
  });
  await resignPayments(manager, signed);

  return true;
}
