import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppException } from '../../utils/errors/app.exception';
import { ERRORS } from '../../utils/errors/errors';
import { FREE_PLAN_DURATION } from '../subscriptions/entities/plan.entity';
import { durationMonthsSql } from '../subscriptions/plan-query';
import { ACTIVE_PERIOD } from '../subscriptions/plan-subscribers';

export interface CurrentSubscription {
  current: {
    planName: string;
    durationMonths: number | null;
    bookLimit: number;
    editorLimit: number;
    periodStartsAt: Date | null;
    periodEndsAt: Date | null;
  };
  usage: {
    books: number;
    editors: number;
  };
  // Credit (VND) của NXB, trừ vào lần mua gói sau
  creditBalance: number;
}

interface Row {
  creditBalance: number;
  planName: string;
  durationMonths: number | null;
  bookLimit: number;
  editorLimit: number;
  periodStartsAt: Date | null;
  periodEndsAt: Date | null;
  books: number;
  editors: number;
}

@Injectable()
export class PublisherSubscriptionService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Gói hiện tại và mức đã dùng của NXB mà user này là chủ hoặc biên tập viên.
   * Một câu SQL nên các số đọc cùng một thời điểm, không cần transaction.
   * Đang trong kỳ: lấy từ snapshot payment (đúng thứ NXB đã mua, kể cả gói
   * đã bị sửa hoặc xóa); không có kỳ: gói Free với giá trị hiện tại. Snapshot
   * NOT NULL nên COALESCE chỉ rơi về Free khi không có kỳ.
   */
  async getCurrent(userId: string): Promise<CurrentSubscription> {
    const [row] = await this.dataSource.query<Row[]>(
      `SELECT COALESCE(cur.plan_name, fp.name) AS "planName",
              ${durationMonthsSql('cur.duration')} AS "durationMonths",
              COALESCE(cur.book_limit, fp.book_limit) AS "bookLimit",
              COALESCE(cur.editor_limit, fp.editor_limit) AS "editorLimit",
              cur.period_starts_at AS "periodStartsAt",
              cur.period_ends_at AS "periodEndsAt",
              me.credit_balance AS "creditBalance",
              (SELECT count(*)::int FROM books b WHERE b.publisher_id = me.id) AS books,
              (SELECT count(*)::int FROM editors e WHERE e.publisher_id = me.id) AS editors
       FROM (
         SELECT p.id, p.credit_balance FROM publishers p WHERE p.user_id = $1
         UNION ALL
         SELECT p.id, p.credit_balance
         FROM editors e JOIN publishers p ON p.id = e.publisher_id
         WHERE e.user_id = $1
       ) me
       LEFT JOIN LATERAL (
         SELECT pm.plan_name, pm.duration, pm.book_limit, pm.editor_limit,
                pm.period_starts_at, pm.period_ends_at
         FROM payments pm
         WHERE pm.publisher_id = me.id AND ${ACTIVE_PERIOD}
         ORDER BY pm.period_ends_at DESC
         LIMIT 1
       ) cur ON true
       LEFT JOIN plans fp ON fp.duration = '${FREE_PLAN_DURATION}'`,
      [userId],
    );

    if (!row) {
      throw new AppException(ERRORS.NOT_FOUND);
    }

    const { books, editors, creditBalance, ...current } = row;

    return { current, usage: { books, editors }, creditBalance };
  }
}
