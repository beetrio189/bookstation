import { randomInt } from 'node:crypto';
import { SePayPgClient } from 'sepay-pg-node';
import { env } from '../../config';

/**
 * Client SDK chính thức của cổng SePay (sepay-pg-node): ký form checkout và gọi
 * API đơn hàng (order.retrieve, order.cancel) bằng Basic auth merchant:secret.
 */
export const sepay = new SePayPgClient({
  env: env.sepayEnv,
  merchant_id: env.sepayMerchantId,
  secret_key: env.sepaySecretKey,
});

const ORDER_CODE_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Mã đơn = tiền tố + 8 ký tự [0-9A-Z].
 * "BS": đơn qua SePay, khớp cấu trúc mã thanh toán đã cấu hình trên SePay.
 * "CR": đơn trả hết bằng credit, không bao giờ gửi sang SePay.
 */
export function generateOrderCode(prefix: 'BS' | 'CR'): string {
  let suffix = '';

  for (let i = 0; i < 8; i++) {
    suffix += ORDER_CODE_CHARS[randomInt(ORDER_CODE_CHARS.length)];
  }

  return `${prefix}${suffix}`;
}

export interface SepayCheckoutInput {
  orderCode: string;
  amount: number;
  description: string;
  successUrl: string;
  errorUrl: string;
  cancelUrl: string;
}

export interface SepayCheckoutForm {
  action: string;
  fields: Record<string, string>;
}

/**
 * Dữ liệu form POST (trình duyệt tự gửi) sang trang thanh toán SePay. SDK ký
 * HMAC-SHA256 (base64) theo thứ tự key của object; merchant đặt đầu để SDK ghi
 * đè đúng chỗ (SDK luôn gán lại merchant từ config).
 */
export function buildCheckoutForm(
  input: SepayCheckoutInput,
): SepayCheckoutForm {
  const fields = sepay.checkout.initOneTimePaymentFields({
    merchant: env.sepayMerchantId,
    currency: 'VND',
    order_amount: input.amount,
    operation: 'PURCHASE',
    order_description: input.description,
    order_invoice_number: input.orderCode,
    success_url: input.successUrl,
    error_url: input.errorUrl,
    cancel_url: input.cancelUrl,
  });

  return {
    action: sepay.checkout.initCheckoutUrl(),
    fields: Object.fromEntries(
      Object.entries(fields).map(([name, value]) => [name, String(value)]),
    ),
  };
}
