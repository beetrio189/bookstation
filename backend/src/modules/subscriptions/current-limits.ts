import { EntityManager } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { FREE_PLAN_DURATION, Plan } from './entities/plan.entity';
import { ACTIVE_PERIOD } from './plan-subscribers';

export interface CurrentLimits {
  bookLimit: number;
  editorLimit: number;
}

/**
 * Hạn mức đang áp cho NXB tại thời điểm hiện tại: kỳ đang chạy thì lấy snapshot
 * trong payment (đúng thứ đã mua), không có kỳ thì theo gói Free hiện tại.
 * Giống cách GET /publisher/subscription tính.
 */
export const currentLimits = async (
  manager: EntityManager,
  publisherId: string,
): Promise<CurrentLimits> => {
  const paid = await manager
    .createQueryBuilder(Payment, 'pm')
    .where('pm.publisher_id = :publisherId', { publisherId })
    .andWhere(ACTIVE_PERIOD)
    .orderBy('pm.period_ends_at', 'DESC')
    .getOne();

  const source =
    paid ??
    (await manager.findOneByOrFail(Plan, { duration: FREE_PLAN_DURATION }));

  return { bookLimit: source.bookLimit, editorLimit: source.editorLimit };
};
