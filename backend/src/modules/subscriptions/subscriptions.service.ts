import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from './entities/plan.entity';
import { PublicPlan, selectPlanFields } from './plan-query';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Plan)
    private readonly plansRepository: Repository<Plan>,
  ) {}

  /** Mọi gói, kể cả gói Free. Sắp theo thời hạn rồi giá: gói Free tự xuống cuối. */
  async listPlans(): Promise<{ items: PublicPlan[] }> {
    const items = await selectPlanFields(
      this.plansRepository.createQueryBuilder('plan'),
    )
      .orderBy('plan.duration', 'ASC')
      .addOrderBy('plan.price', 'ASC')
      .getRawMany<PublicPlan>();

    return { items };
  }
}
