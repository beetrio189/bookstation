import { IsOptional } from 'class-validator';
import { RequiredNoteDto } from './required-note.dto';
import {
  IsPlanDescription,
  IsPlanLimit,
  IsPlanName,
  IsPlanWeight,
} from './plan-fields';

/**
 * Sửa gói (PUT): gửi đủ mọi trường, quy tắc như lúc tạo. Không sửa thời hạn
 * (ghim để lịch sử không lẫn); trường lạ (durationMonths…) bị bỏ. Thiếu
 * description hoặc gửi "" là xóa mô tả. DTO chỉ bắt giá ≥ 0 vì không biết gói
 * Free hay trả phí: service kiểm tiếp (Free phải 0 đ, trả phí ≥ MIN_PAYMENT_AMOUNT).
 */
export class UpdatePlanDto extends RequiredNoteDto {
  @IsPlanName()
  name: string;

  @IsPlanDescription()
  @IsOptional()
  description?: string;

  @IsPlanLimit('Giá')
  price: number;

  @IsPlanLimit('Số sách tối đa')
  bookLimit: number;

  @IsPlanLimit('Số biên tập viên tối đa')
  editorLimit: number;

  @IsPlanWeight()
  featuredWeight: number;
}
