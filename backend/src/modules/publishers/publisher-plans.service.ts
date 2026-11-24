import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FREE_PLAN_DURATION } from '../subscriptions/entities/plan.entity';
import { PaymentQuote, quotePayment } from '../subscriptions/payment-quote';
import { durationMonthsSql, PublicPlan } from '../subscriptions/plan-query';

export interface PublisherPlan extends PublicPlan {
  canBuy: boolean;
}

@Injectable()
export class PublisherPlansService {
  constructor(private readonly dataSource: DataSource) {}

  async listPlans(userId: string): Promise<{ items: PublisherPlan[] }> {
    const items = await this.dataSource.query<PublisherPlan[]>(
      `SELECT plan.id, plan.name, plan.description, plan.price,
              ${durationMonthsSql('plan.duration')} AS "durationMonths",
              plan.book_limit AS "bookLimit",
              plan.editor_limit AS "editorLimit",
              (plan.duration <> '${FREE_PLAN_DURATION}'
                AND usage.books <= plan.book_limit
                AND usage.editors <= plan.editor_limit) AS "canBuy"
       FROM plans plan
       CROSS JOIN (
         SELECT (SELECT count(*) FROM books b WHERE b.publisher_id = p.id)::int AS books,
                (SELECT count(*) FROM editors e WHERE e.publisher_id = p.id)::int AS editors
         FROM publishers p
         WHERE p.user_id = $1
       ) usage
       ORDER BY plan.duration ASC, plan.price ASC`,
      [userId],
    );

    return { items };
  }

  quote(userId: string, planId: string): Promise<PaymentQuote> {
    return quotePayment(this.dataSource.manager, userId, planId);
  }
}
