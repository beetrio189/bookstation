import { EntityManager } from 'typeorm';
import { UserStatus } from '../../utils/enums/user-status.enum';

const ACTIVE_PERIOD = `pm.status = 'success'
  AND pm.period_starts_at <= now() AND pm.period_ends_at > now()`;

export interface PlanSubscriber {
  userId: string;
  email: string;
  planName: string;
  periodEndsAt: Date;
}

export interface FreePlanPublisher {
  userId: string;
  email: string;
}

/**
 * NXB đang trong kỳ của gói này (mỗi NXB một dòng, lấy kỳ kết thúc muộn nhất).
 * NXB bị khóa không nhận mail; NXB đã xóa không còn trong bảng publishers.
 */
export const findPlanSubscribers = (
  manager: EntityManager,
  planId: string,
): Promise<PlanSubscriber[]> =>
  manager.query<PlanSubscriber[]>(
    `SELECT DISTINCT ON (p.id)
            u.id AS "userId", u.notification_email AS email,
            pm.plan_name AS "planName", pm.period_ends_at AS "periodEndsAt"
     FROM payments pm
     JOIN publishers p ON p.id = pm.publisher_id
     JOIN users u ON u.id = p.user_id
     WHERE pm.plan_id = $1 AND ${ACTIVE_PERIOD} AND u.status = $2
     ORDER BY p.id, pm.period_ends_at DESC`,
    [planId, UserStatus.ACTIVE],
  );

export const findFreePlanPublishers = (
  manager: EntityManager,
): Promise<FreePlanPublisher[]> =>
  manager.query<FreePlanPublisher[]>(
    `SELECT u.id AS "userId", u.notification_email AS email
     FROM publishers p
     JOIN users u ON u.id = p.user_id
     WHERE u.status = $1
       AND NOT EXISTS (
         SELECT 1 FROM payments pm WHERE pm.publisher_id = p.id AND ${ACTIVE_PERIOD}
       )`,
    [UserStatus.ACTIVE],
  );
