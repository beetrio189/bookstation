import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUniqueViolation } from '../../utils/database-errors';
import { SystemActionType } from '../../utils/enums/system-action-type.enum';
import { AppException } from '../../utils/errors/app.exception';
import { ERRORS } from '../../utils/errors/errors';
import { Plan } from '../subscriptions/entities/plan.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
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
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(Plan)
    private readonly plansRepository: Repository<Plan>,
  ) {}

  /**
   * Mọi gói, kể cả gói Free và gói đã ẩn. Sắp theo thời hạn rồi giá: gói Free
   * (duration 'infinity') tự xuống cuối. 'infinity' không đổi ra số tháng được
   * (ép int báo lỗi) nên trả NULL.
   */
  async list(): Promise<{ items: PlanListItem[] }> {
    const items = await this.plansRepository
      .createQueryBuilder('plan')
      .select('plan.id', 'id')
      .addSelect('plan.name', 'name')
      .addSelect('plan.description', 'description')
      .addSelect('plan.price', 'price')
      .addSelect(
        `CASE WHEN plan.duration = 'infinity' THEN NULL
              ELSE (EXTRACT(YEAR FROM plan.duration) * 12 + EXTRACT(MONTH FROM plan.duration))::int
         END`,
        'durationMonths',
      )
      .addSelect('plan.book_limit', 'bookLimit')
      .addSelect('plan.editor_limit', 'editorLimit')
      .addSelect('plan.is_active', 'isActive')
      .addSelect('plan.created_at', 'createdAt')
      .addSelect('plan.updated_at', 'updatedAt')
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
}
