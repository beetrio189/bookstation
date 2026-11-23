import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config';
import { Payment } from './entities/payment.entity';

// Các cột tiền / kỳ được ký. Không ký publisher_id, plan_id (ON DELETE SET NULL tự đổi
// khi xóa NXB / gói) và snapshot hiển thị. Đổi bất kỳ cột nào ở đây thì phải ký lại.
export type SignedPaymentFields = Pick<
  Payment,
  | 'id'
  | 'status'
  | 'price'
  | 'creditUsed'
  | 'creditReturned'
  | 'periodStartsAt'
  | 'periodEndsAt'
  | 'orderCode'
>;

// Mảng JSON theo thứ tự cố định để chuỗi ký không phụ thuộc thứ tự key
function canonical(payment: SignedPaymentFields): string {
  return JSON.stringify([
    payment.id,
    payment.status,
    payment.price,
    payment.creditUsed,
    payment.creditReturned,
    payment.periodStartsAt?.toISOString() ?? null,
    payment.periodEndsAt?.toISOString() ?? null,
    payment.orderCode,
  ]);
}

/** HMAC-SHA256 hex (64 ký tự), lưu vào payments.signature */
export function signPayment(payment: SignedPaymentFields): string {
  return createHmac('sha256', env.paymentHmacKey)
    .update(canonical(payment))
    .digest('hex');
}

/** false khi chưa ký hoặc các cột đã ký bị sửa ngoài code */
export function verifyPayment(
  payment: SignedPaymentFields & Pick<Payment, 'signature'>,
): boolean {
  if (!payment.signature) {
    return false;
  }

  const expected = Buffer.from(signPayment(payment), 'hex');
  const actual = Buffer.from(payment.signature, 'hex');

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
