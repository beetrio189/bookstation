import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { isUniqueViolation } from '../../utils/database-errors';
import { SystemActionType } from '../../utils/enums/system-action-type.enum';
import { AppException } from '../../utils/errors/app.exception';
import { ERRORS } from '../../utils/errors/errors';
import { MailQueueService } from '../mail/mail-queue.service';
import { MIN_PAYMENT_AMOUNT } from '../subscriptions/payment-quote';
import { Plan } from '../subscriptions/entities/plan.entity';
import {
  findPlanSubscribers,
  PlanSubscriber,
} from '../subscriptions/plan-subscribers';
import { PublicPlan, selectPlanFields } from '../subscriptions/plan-query';
import { RequiredNoteDto } from './dto/required-note.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { writeSystemLog } from './write-system-log';

export interface PlanCreated {
  id: string;
  name: string;
  durationMonths: number;
  description: string | null;
  price: number;
  bookLimit: number;
  editorLimit: number;
  featuredWeight: number;
  createdAt: Date;
}

export interface PlanListItem extends PublicPlan {
  featuredWeight: number;
  createdAt: Date;
  updatedAt: Date;
}

const NOTIFIED_FIELDS = ['price', 'bookLimit', 'editorLimit'] as const;
const EDITABLE_FIELDS = [
  'name',
  'description',
  'price',
  'bookLimit',
  'editorLimit',
  'featuredWeight',
] as const;

const selectAdminPlanFields = (query: SelectQueryBuilder<Plan>) =>
  selectPlanFields(query)
    .addSelect('plan.featured_weight', 'featuredWeight')
    .addSelect('plan.created_at', 'createdAt')
    .addSelect('plan.updated_at', 'updatedAt');

const logName = ({ name, durationMonths }: PlanListItem) =>
  durationMonths === null
    ? `${name} (vĩnh viễn)`
    : `${name} (${durationMonths} tháng)`;

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(
    @InjectRepository(Plan)
    private readonly plansRepository: Repository<Plan>,
    private readonly mailQueueService: MailQueueService,
  ) {}

  /** Mọi gói, kể cả gói Free. Sắp theo thời hạn rồi giá: gói Free tự xuống cuối. */
  async list(): Promise<{ items: PlanListItem[] }> {
    const items = await selectAdminPlanFields(
      this.plansRepository.createQueryBuilder('plan'),
    )
      .orderBy('plan.duration', 'ASC')
      .addOrderBy('plan.price', 'ASC')
      .getRawMany<PlanListItem>();

    return { items };
  }

  /**
   * Thêm gói trả phí: INSERT + ghi log trong một transaction. Chỉ ràng buộc
   * UNIQUE (name, duration) trong DB (kể cả request song song); tên và hạn mức
   * giữa các gói cùng tên không cần khớp nhau.
   */
  async create(actorId: string, dto: CreatePlanDto): Promise<PlanCreated> {
    const savedDescription = dto.description || null;

    try {
      return await this.plansRepository.manager.transaction(async (manager) => {
        const row = await manager.save(
          manager.create(Plan, {
            name: dto.name,
            duration: `${dto.durationMonths} months`,
            description: savedDescription,
            price: dto.price,
            bookLimit: dto.bookLimit,
            editorLimit: dto.editorLimit,
            featuredWeight: dto.featuredWeight,
          }),
        );

        await writeSystemLog(manager, actorId, {
          actionType: SystemActionType.PLAN_CREATION,
          targetId: row.id,
          targetName: `${dto.name} (${dto.durationMonths} tháng)`,
          note: dto.note,
        });

        return {
          id: row.id,
          name: dto.name,
          durationMonths: dto.durationMonths,
          description: savedDescription,
          price: dto.price,
          bookLimit: dto.bookLimit,
          editorLimit: dto.editorLimit,
          featuredWeight: dto.featuredWeight,
          createdAt: row.createdAt,
        };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppException(ERRORS.PLAN_ALREADY_EXISTS);
      }

      throw error;
    }
  }

  /**
   * Sửa gói (PUT) trong một transaction (khóa dòng, UPDATE, log). Giá kiểm theo
   * loại gói: Free phải 0 đ, trả phí ≥ MIN_PAYMENT_AMOUNT. Không đổi gì thì trả
   * gói luôn, không ghi log. Sau commit, nếu giá hoặc hạn mức thật sự đổi thì
   * đẩy job báo NXB; đẩy lỗi chỉ ghi log vì gói đã sửa xong.
   */
  async update(
    actorId: string,
    id: string,
    dto: UpdatePlanDto,
  ): Promise<PlanListItem> {
    const values = {
      name: dto.name,
      description: dto.description || null,
      price: dto.price,
      bookLimit: dto.bookLimit,
      editorLimit: dto.editorLimit,
      featuredWeight: dto.featuredWeight,
    };

    let result: { plan: PlanListItem; notify: boolean };

    try {
      result = await this.plansRepository.manager.transaction(
        async (manager) => {
          const before = await this.lockPlan(manager, id);

          if (before.durationMonths === null) {
            if (values.price > 0) {
              throw new AppException(ERRORS.FREE_PLAN_PRICE_LOCKED);
            }
          } else if (values.price < MIN_PAYMENT_AMOUNT) {
            throw new AppException(ERRORS.PLAN_PRICE_TOO_LOW);
          }

          if ( EDITABLE_FIELDS.every((field) => values[field] === before[field] )) {
            return { plan: before, notify: false };
          }

          await manager.update(Plan, { id }, values);

          const plan = await selectAdminPlanFields(
            manager.createQueryBuilder(Plan, 'plan'),
          )
            .where('plan.id = :id', { id })
            .getRawOne<PlanListItem>();

          if (!plan) {
            throw new AppException(ERRORS.NOT_FOUND);
          }

          await writeSystemLog(manager, actorId, {
            actionType: SystemActionType.PLAN_UPDATE,
            targetId: id,
            targetName: logName(plan),
            note: dto.note,
          });

          return {
            plan,
            notify: NOTIFIED_FIELDS.some(
              (field) => plan[field] !== before[field],
            ),
          };
        },
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppException(ERRORS.PLAN_ALREADY_EXISTS);
      }

      throw error;
    }

    if (result.notify) {
      try {
        await this.mailQueueService.enqueuePlanUpdated(id);
      } catch (error) {
        this.logger.error(error);
      }
    }

    return result.plan;
  }

  /**
   * Xóa gói trả phí (gói Free bị chặn ở đây và bởi trigger trong DB). NXB đang
   * dùng gói phải tìm trước khi xóa (sau đó payments.plan_id thành NULL); họ giữ
   * hạn mức đến hết kỳ nhờ snapshot. Sau commit đẩy mỗi NXB một job mail; đẩy
   * lỗi chỉ ghi log vì gói đã xóa xong.
   */
  async remove(
    actorId: string,
    id: string,
    dto: RequiredNoteDto,
  ): Promise<Record<string, never>> {
    const subscribers = await this.plansRepository.manager.transaction(
      async (manager) => {
        const plan = await this.lockPlan(manager, id);

        if (plan.durationMonths === null) {
          throw new AppException(ERRORS.FREE_PLAN_NOT_DELETABLE);
        }

        const found: PlanSubscriber[] = await findPlanSubscribers(manager, id);

        await manager.delete(Plan, { id });

        await writeSystemLog(manager, actorId, {
          actionType: SystemActionType.PLAN_DELETION,
          targetId: id,
          targetName: logName(plan),
          note: dto.note,
        });

        return found;
      },
    );

    if (subscribers.length > 0) {
      try {
        await this.mailQueueService.enqueuePlanDeletedNotices(
          subscribers.map(({ userId, email, planName, periodEndsAt }) => ({
            userId,
            email,
            planName,
            periodEndsAt: new Date(periodEndsAt).toISOString(),
          })),
        );
      } catch (error) {
        this.logger.error(error);
      }
    }

    return {};
  }

  private async lockPlan(
    manager: EntityManager,
    id: string,
  ): Promise<PlanListItem> {
    const plan = await selectAdminPlanFields(
      manager.createQueryBuilder(Plan, 'plan'),
    )
      .where('plan.id = :id', { id })
      .setLock('pessimistic_write')
      .getRawOne<PlanListItem>();

    if (!plan) {
      throw new AppException(ERRORS.NOT_FOUND);
    }

    return plan;
  }
}
