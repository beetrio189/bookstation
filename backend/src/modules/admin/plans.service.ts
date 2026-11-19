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

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(Plan)
    private readonly plansRepository: Repository<Plan>,
  ) {}

  /**
   * Thêm gói trả phí trong một transaction: khóa theo tên gói để 2 request cùng
   * tên không chen nhau lúc so hạn mức, kiểm hạn mức khớp gói cùng tên, INSERT
   * rồi ghi log. Trùng (name, duration), kể cả song song, do UNIQUE trong DB chặn.
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
        await manager.query(
          `SELECT pg_advisory_xact_lock(hashtext('plans:' || $1))`,
          [name],
        );

        const sameName = await manager.findOne(Plan, {
          select: { bookLimit: true, editorLimit: true },
          where: { name },
        });

        if (
          sameName &&
          (sameName.bookLimit !== bookLimit ||
            sameName.editorLimit !== editorLimit)
        ) {
          throw new AppException(ERRORS.PLAN_LIMITS_MISMATCH);
        }

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
