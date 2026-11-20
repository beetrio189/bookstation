import { IsIn, IsOptional } from 'class-validator';
import { ActionNoteDto } from './action-note.dto';
import {
  IsPlanDescription,
  IsPlanLimit,
  IsPlanName,
  IsPlanPrice,
  PLAN_DURATION_MONTHS,
} from './plan-fields';

export { PLAN_DURATION_MONTHS };

/**
 * Admin thêm gói trả phí. Tên gói cũng là tên hiển thị, trùng tên gói khác (kể cả
 * Free) được miễn khác thời hạn. Số phải gửi dạng number trong JSON, chuỗi "6" bị từ chối.
 */
export class CreatePlanDto extends ActionNoteDto {
  @IsPlanName()
  name: string;

  @IsIn(PLAN_DURATION_MONTHS, {
    message: `Thời hạn chỉ được là ${PLAN_DURATION_MONTHS.join(', ')} tháng`,
  })
  durationMonths: number;

  @IsPlanDescription()
  @IsOptional()
  description?: string;

  @IsPlanPrice()
  price: number;

  @IsPlanLimit('Số sách tối đa')
  bookLimit: number;

  @IsPlanLimit('Số biên tập viên tối đa')
  editorLimit: number;
}
