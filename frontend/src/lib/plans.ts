// Khớp response /api/admin/plans (backend bỏ trường null)
export interface PlanItem {
  id: string;
  name: string;
  // Không có = gói Free (thời hạn vô hạn)
  durationMonths?: number;
  description?: string;
  price: number;
  bookLimit: number;
  editorLimit: number;
  createdAt: string;
  updatedAt: string;
}

// Khớp GET /api/subscription-plans (không có createdAt / updatedAt)
export type PublicPlan = Omit<PlanItem, "createdAt" | "updatedAt">;

// Khớp GET /api/publisher/plans
export interface PublisherPlan extends PublicPlan {
  // false: gói Free, hoặc số sách / biên tập viên đang có vượt giới hạn của gói
  canBuy: boolean;
}

// Khớp GET /api/publisher/subscription
export interface CurrentSubscription {
  current: {
    planName: string;
    // Không có = gói Free
    durationMonths?: number;
    bookLimit: number;
    editorLimit: number;
    // Không có khi đang dùng gói Free
    periodStartsAt?: string;
    periodEndsAt?: string;
  };
  usage: { books: number; editors: number };
  creditBalance: number;
}

// Khớp GET /api/publisher/plans/:id/quote (VND)
export interface PlanQuote {
  price: number;
  creditBalance: number;
  creditReturned: number;
  creditUsed: number;
  total: number;
}

// Mã lỗi khi mua gói (backend dải 4xxx)
export const PURCHASE_ERROR_CODES = {
  PLAN_NOT_PURCHASABLE: 4000,
  PLAN_LIMIT_EXCEEDED: 4001,
} as const;

// Khớp backend/src/modules/admin/dto/plan-fields.ts
export const PLAN_DURATION_MONTHS = [6, 12, 24] as const;
export const PLAN_NAME_MAX_LENGTH = 50;
export const PLAN_DESCRIPTION_MAX_LENGTH = 1000;
export const PLAN_NUMBER_MAX = 2_000_000_000;
// Khớp MIN_PAYMENT_AMOUNT backend: SePay không nhận thanh toán dưới 1.000 đ
export const PLAN_PRICE_MIN = 1000;

// Mã lỗi backend (backend/src/utils/errors/errors.ts)
export const PLAN_ERROR_CODES = {
  NOTHING_TO_UPDATE: 1007,
  PLAN_ALREADY_EXISTS: 3004,
  FREE_PLAN_PRICE_LOCKED: 3006,
  FREE_PLAN_NOT_DELETABLE: 3007,
} as const;

export const isFreePlan = (plan: Pick<PlanItem, "durationMonths">) =>
  plan.durationMonths === undefined;

// Giống backend: cắt hai đầu, gộp dấu cách liền nhau
export const normalizePlanName = (value: string) =>
  value.trim().replace(/\s+/g, " ");

export const isValidPlanName = (value: string) => /^[a-zA-Z0-9 ]+$/.test(value);

export const formatNumber = (value: number) =>
  new Intl.NumberFormat("vi-VN").format(value);

export const formatPrice = (price: number) =>
  price === 0 ? "Miễn phí" : `${formatNumber(price)} đ`;

export const durationLabel = (plan: Pick<PlanItem, "durationMonths">) =>
  plan.durationMonths === undefined
    ? "Mặc định"
    : `${plan.durationMonths} tháng`;

// Tên kèm thời hạn, dùng trong tiêu đề hộp thoại và toast: "Basic (6 tháng)"
export const planTitle = (plan: PlanItem) =>
  isFreePlan(plan) ? plan.name : `${plan.name} (${plan.durationMonths} tháng)`;

// Tên kèm số tháng không ngoặc, dùng ở khu NXB: "Basic 6 tháng"
export const planFullName = (plan: {
  name: string;
  durationMonths?: number;
}) =>
  plan.durationMonths === undefined
    ? plan.name
    : `${plan.name} ${plan.durationMonths} tháng`;

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));

/**
 * Nhóm theo thời hạn (backend đã sắp theo thời hạn rồi giá, gói Free cuối),
 * gói Free vào nhóm "Mặc định". Giữ nguyên thứ tự backend trả về.
 */
export function groupPlans<T extends Pick<PlanItem, "durationMonths">>(
  items: T[],
) {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const label = durationLabel(item);
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }

  return [...groups].map(([label, plans]) => ({ label, plans }));
}
