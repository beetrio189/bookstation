import { EntityManager } from 'typeorm';
import { AppException } from '../../utils/errors/app.exception';
import { ERRORS } from '../../utils/errors/errors';
import { FREE_PLAN_DURATION } from './entities/plan.entity';
import { durationMonthsSql } from './plan-query';
import { ACTIVE_PERIOD } from './plan-subscribers';

/**
 * Số tiền nhỏ nhất SePay cho thanh toán (VND). Tổng phải trả chỉ được là 0 (trả hết
 * bằng credit) hoặc từ mức này trở lên; giá gói tối thiểu cũng bằng mức này.
 */
export const MIN_PAYMENT_AMOUNT = 1000;

/** Số tiền (VND) khi NXB mua một gói ngay lúc này */
export interface PaymentQuote {
  price: number;
  creditBalance: number;
  creditReturned: number;
  creditUsed: number;
  total: number;
}

/** Thứ POST /publisher/payments cần để tạo đơn: NXB, snapshot gói và số tiền */
export interface PurchaseContext {
  publisherId: string;
  publisherName: string;
  plan: {
    id: string;
    name: string;
    duration: string;
    durationMonths: number;
    bookLimit: number;
    editorLimit: number;
    featuredWeight: number;
  };
  quote: PaymentQuote;
}

interface Row {
  publisherId: string;
  publisherName: string;
  planName: string;
  duration: string;
  durationMonths: number;
  price: number;
  isFree: boolean;
  bookLimit: number;
  editorLimit: number;
  featuredWeight: number;
  books: number;
  editors: number;
  creditBalance: number;
  creditReturned: number;
}

/**
 * creditReturned của kỳ đang dùng (payment alias pm):
 * floor(giá × số ngày trọn còn lại / tổng số ngày của kỳ). Ngày đang dùng dở
 * tính là đã dùng. Tính bằng bigint để price × ngày không tràn integer.
 */
export const CREDIT_RETURNED_SQL = `(pm.price::bigint
    * floor(extract(epoch FROM pm.period_ends_at - now()) / 86400)::bigint
    / NULLIF(round(extract(epoch FROM pm.period_ends_at - pm.period_starts_at) / 86400), 0)::bigint
  )::int`;

/**
 * Đọc mọi thứ cần để chủ NXB (userId) mua gói planId. Một câu SQL nên mọi số đọc
 * cùng một thời điểm. Lỗi: gói không tồn tại → 404, gói Free →
 * PLAN_NOT_PURCHASABLE, vượt giới hạn → PLAN_LIMIT_EXCEEDED.
 */
export async function loadPurchase(
  manager: EntityManager,
  userId: string,
  planId: string,
): Promise<PurchaseContext> {
  const [row] = await manager.query<Row[]>(
    `SELECT me.id AS "publisherId",
            me.publisher_name AS "publisherName",
            pl.name AS "planName",
            pl.duration::text AS duration,
            ${durationMonthsSql('pl.duration')} AS "durationMonths",
            pl.price,
            pl.duration = '${FREE_PLAN_DURATION}' AS "isFree",
            pl.book_limit AS "bookLimit",
            pl.editor_limit AS "editorLimit",
            pl.featured_weight AS "featuredWeight",
            (SELECT count(*) FROM books b WHERE b.publisher_id = me.id)::int AS books,
            (SELECT count(*) FROM editors e WHERE e.publisher_id = me.id)::int AS editors,
            me.credit_balance AS "creditBalance",
            COALESCE((
              SELECT ${CREDIT_RETURNED_SQL}
              FROM payments pm
              WHERE pm.publisher_id = me.id AND ${ACTIVE_PERIOD}
              ORDER BY pm.period_ends_at DESC
              LIMIT 1
            ), 0) AS "creditReturned"
     FROM publishers me
     JOIN plans pl ON pl.id = $2
     WHERE me.user_id = $1`,
    [userId, planId],
  );

  if (!row) {
    throw new AppException(ERRORS.NOT_FOUND);
  }

  if (row.isFree) {
    throw new AppException(ERRORS.PLAN_NOT_PURCHASABLE);
  }

  if (row.books > row.bookLimit || row.editors > row.editorLimit) {
    throw new AppException(ERRORS.PLAN_LIMIT_EXCEEDED);
  }

  return {
    publisherId: row.publisherId,
    publisherName: row.publisherName,
    plan: {
      id: planId,
      name: row.planName,
      duration: row.duration,
      durationMonths: row.durationMonths,
      bookLimit: row.bookLimit,
      editorLimit: row.editorLimit,
      featuredWeight: row.featuredWeight,
    },
    quote: calculateQuote(row.price, row.creditBalance, row.creditReturned),
  };
}

/** Số tiền nếu mua gói này ngay bây giờ (GET /publisher/plans/:id/quote) */
export async function quotePayment(
  manager: EntityManager,
  userId: string,
  planId: string,
): Promise<PaymentQuote> {
  return (await loadPurchase(manager, userId, planId)).quote;
}

/**
 * Dùng tối đa credit đang có. Nếu sau đó còn phải trả nhưng dưới MIN_PAYMENT_AMOUNT
 * thì dùng bớt credit để trả đúng MIN_PAYMENT_AMOUNT (phần credit chưa dùng vẫn giữ).
 */
export function calculateQuote(
  price: number,
  creditBalance: number,
  creditReturned: number,
): PaymentQuote {
  let creditUsed = Math.min(price, creditBalance + creditReturned);

  if (price - creditUsed > 0 && price - creditUsed < MIN_PAYMENT_AMOUNT) {
    creditUsed = Math.max(0, price - MIN_PAYMENT_AMOUNT);
  }

  return {
    price,
    creditBalance,
    creditReturned,
    creditUsed,
    total: price - creditUsed,
  };
}
