import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { isUniqueViolation } from '../../utils/database-errors';
import { SystemActionType } from '../../utils/enums/system-action-type.enum';
import { AppException } from '../../utils/errors/app.exception';
import { ERRORS } from '../../utils/errors/errors';
import { MailQueueService } from '../mail/mail-queue.service';
import {
  FREE_PLAN_DURATION,
  Plan,
} from '../subscriptions/entities/plan.entity';
import {
  findPlanSubscribers,
  PlanSubscriber,
} from '../subscriptions/plan-subscribers';
import { ActionNoteDto } from './dto/action-note.dto';
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
  createdAt: Date;
}

export interface PlanListItem {
  id: string;
  name: string;
  durationMonths: number | null;
  description: string | null;
  price: number;
  bookLimit: number;
  editorLimit: number;
  createdAt: Date;
  updatedAt: Date;
}

const NOTIFIED_FIELDS = ['price', 'bookLimit', 'editorLimit'] as const;

/**
 * Cột trả về của một gói. 'infinity' (gói Free) không đổi ra số tháng được (ép
 * int báo lỗi) nên trả NULL.
 */
const selectPlanFields = (query: SelectQueryBuilder<Plan>) =>
  query
    .select('plan.id', 'id')
    .addSelect('plan.name', 'name')
    .addSelect('plan.description', 'description')
    .addSelect('plan.price', 'price')
    .addSelect(
      `CASE WHEN plan.duration = '${FREE_PLAN_DURATION}' THEN NULL
            ELSE (EXTRACT(YEAR FROM plan.duration) * 12 + EXTRACT(MONTH FROM plan.duration))::int
       END`,
      'durationMonths',
    )
    .addSelect('plan.book_limit', 'bookLimit')
    .addSelect('plan.editor_limit', 'editorLimit')
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
    const items = await selectPlanFields(
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
  async create(
    actorId: string,
    {
      name,
      durationMonths,
      description,
      price,
      bookLimit,
      editorLimit,
      note,
    }: CreatePlanDto,
  ): Promise<PlanCreated> {
    const savedDescription = description || null;

    try {
      return await this.plansRepository.manager.transaction(async (manager) => {
        const [row] = await manager.query<{ id: string; createdAt: Date }[]>(
          `INSERT INTO plans (name, duration, description, price, book_limit, editor_limit)
           VALUES ($1, make_interval(months => $2), $3, $4, $5, $6)
           RETURNING id, created_at AS "createdAt"`,
          [
            name,
            durationMonths,
            savedDescription,
            price,
            bookLimit,
            editorLimit,
          ],
        );

        await writeSystemLog(manager, actorId, {
          actionType: SystemActionType.PLAN_CREATION,
          targetId: row.id,
          targetName: `${name} (${durationMonths} tháng)`,
          note,
        });

        return {
          id: row.id,
          name,
          durationMonths,
          description: savedDescription,
          price,
          bookLimit,
          editorLimit,
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
   * Sửa gói trong một transaction (khóa dòng, UPDATE, log). Gói Free không đổi
   * giá. Sau commit, nếu giá hoặc hạn mức thật sự đổi thì đẩy job báo NXB; đẩy
   * lỗi chỉ ghi log vì gói đã sửa xong.
   */
  async update(
    actorId: string,
    id: string,
    { note, ...fields }: UpdatePlanDto,
  ): Promise<PlanListItem> {
    const changes = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    ) as Partial<Omit<UpdatePlanDto, 'note'>>;

    if (Object.keys(changes).length === 0) {
      throw new AppException(ERRORS.NOTHING_TO_UPDATE);
    }

    let result: { plan: PlanListItem; notify: boolean };

    try {
      result = await this.plansRepository.manager.transaction(
        async (manager) => {
          const before = await this.lockPlan(manager, id);

          if (before.durationMonths === null && changes.price !== undefined) {
            throw new AppException(ERRORS.FREE_PLAN_PRICE_LOCKED);
          }

          await manager.update(
            Plan,
            { id },
            {
              ...changes,
              ...(changes.description !== undefined && {
                description: changes.description || null,
              }),
            },
          );

          const plan = await selectPlanFields(
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
            note,
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
    { note }: ActionNoteDto,
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
          note,
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
    const plan = await selectPlanFields(
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
