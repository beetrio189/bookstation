import { formatNumber } from "@/lib/plans";

// Khớp form SePay backend trả về (backend/src/modules/subscriptions/sepay-checkout.ts)
export interface SepayCheckoutForm {
  action: string;
  fields: Record<string, string>;
}

// Khớp POST /api/publisher/payments: đơn CR… thành công ngay, đơn BS… kèm form SePay
export type CreatePaymentResult =
  | { id: string; status: "success" }
  | { id: string; checkout: SepayCheckoutForm };

// Khớp GET /api/publisher/payments/pending (backend bỏ trường null)
export interface PendingPayment {
  id: string;
  orderCode: string;
  status: "pending";
  planName: string;
  durationMonths: number;
  price: number;
  creditUsed: number;
  total: number;
  createdAt: string;
  expiresAt: string;
}

// Mã lỗi thanh toán (backend/src/utils/errors/errors.ts, dải 4xxx)
export const PAYMENT_ERROR_CODES = {
  PENDING_PAYMENT_EXISTS: 4003,
  PAYMENT_NOT_PENDING: 4004,
  PAYMENT_EXPIRED: 4005,
  PAYMENT_ALREADY_PAID: 4006,
} as const;

export type PaymentResult = "success" | "cancel" | "error";

export const formatMoney = (value: number) => `${formatNumber(value)} đ`;

// "14:35 23/11/2026"
export const formatDateTime = (value: string) => {
  const date = new Date(value);
  const time = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  const day = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);

  return `${time} ${day}`;
};

/**
 * Gửi form đã ký sang trang thanh toán SePay (POST, trình duyệt rời trang).
 * Không gửi bằng fetch: SePay chuyển hướng tới trang chọn phương thức.
 */
export function submitCheckoutForm({ action, fields }: SepayCheckoutForm) {
  const form = document.createElement("form");

  form.method = "POST";
  form.action = action;

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");

    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}
