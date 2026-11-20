import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PlanSnapshot } from '../modules/mail/mail-queue.constants';
import { MailQueueService } from '../modules/mail/mail-queue.service';
import {
  findFreePlanPublishers,
  findPlanSubscribers,
} from '../modules/subscriptions/plan-subscribers';

interface PlanRow extends PlanSnapshot {
  isFree: boolean;
}

/**
 * Job gom PLAN_UPDATED: đọc lại gói từ DB (không tin payload, hai lần sửa liên
 * tiếp thì mail mang giá trị mới nhất), tìm NXB nhận rồi đẩy mỗi NXB một job.
 */
@Injectable()
export class PlanNoticeService {
  private readonly logger = new Logger(PlanNoticeService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly mailQueueService: MailQueueService,
  ) {}

  async fanOutPlanUpdated(planId: string): Promise<void> {
    const [plan] = await this.dataSource.query<PlanRow[]>(
      `SELECT name, price, book_limit AS "bookLimit", editor_limit AS "editorLimit",
              duration = 'infinity' AS "isFree"
       FROM plans WHERE id = $1`,
      [planId],
    );

    if (!plan) {
      this.logger.log(`Gói ${planId} không còn, bỏ qua mail thay đổi gói`);
      return;
    }

    const { isFree, ...snapshot } = plan;

    if (isFree) {
      const publishers = await findFreePlanPublishers(this.dataSource.manager);

      await this.mailQueueService.enqueuePlanUpdatedNotices(
        publishers.map(({ userId, email }) => ({
          userId,
          email,
          plan: snapshot,
          isFree: true,
        })),
      );
      return;
    }

    const subscribers = await findPlanSubscribers(
      this.dataSource.manager,
      planId,
    );

    await this.mailQueueService.enqueuePlanUpdatedNotices(
      subscribers.map(({ userId, email, planName, periodEndsAt }) => ({
        userId,
        email,
        plan: snapshot,
        isFree: false,
        oldPlanName: planName,
        periodEndsAt: new Date(periodEndsAt).toISOString(),
      })),
    );
  }
}
