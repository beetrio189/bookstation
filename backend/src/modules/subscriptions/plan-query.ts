import { SelectQueryBuilder } from 'typeorm';
import { FREE_PLAN_DURATION, Plan } from './entities/plan.entity';

/**
 * Đổi cột interval ra số tháng. 'infinity' (gói Free) không đổi ra số tháng
 * được (ép int báo lỗi) nên trả NULL.
 */
export const durationMonthsSql = (column: string) =>
  `CASE WHEN ${column} = '${FREE_PLAN_DURATION}' THEN NULL
        ELSE (EXTRACT(YEAR FROM ${column}) * 12 + EXTRACT(MONTH FROM ${column}))::int
   END`;

export interface PublicPlan {
  id: string;
  name: string;
  durationMonths: number | null;
  description: string | null;
  price: number;
  bookLimit: number;
  editorLimit: number;
}

/**
 * Danh sách cột cố định của một gói (alias `plan`): thêm cột vào bảng plans
 * không tự lộ ra API.
 */
export const selectPlanFields = (query: SelectQueryBuilder<Plan>) =>
  query
    .select('plan.id', 'id')
    .addSelect('plan.name', 'name')
    .addSelect('plan.description', 'description')
    .addSelect('plan.price', 'price')
    .addSelect(durationMonthsSql('plan.duration'), 'durationMonths')
    .addSelect('plan.book_limit', 'bookLimit')
    .addSelect('plan.editor_limit', 'editorLimit');
