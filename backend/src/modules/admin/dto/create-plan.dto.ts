import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNotIn,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { FREE_PLAN_NAME } from '../../subscriptions/entities/plan.entity';
import { ActionNoteDto } from './action-note.dto';

const MAX_INT = 2_000_000_000;

// Thời hạn gói được bán (số tháng)
export const PLAN_DURATION_MONTHS = [6, 12, 24];

/**
 * Admin thêm gói trả phí. Tên gói cũng là tên hiển thị; gói Free "none" có sẵn
 * nên không tạo được. Số phải gửi dạng number trong JSON, chuỗi "6" bị từ chối.
 */
export class CreatePlanDto extends ActionNoteDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsNotIn([FREE_PLAN_NAME], { message: 'Không được tạo gói "none"' })
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Tên gói chỉ gồm chữ thường không dấu, chữ số và dấu gạch ngang',
  })
  @MaxLength(50, { message: 'Tên gói quá dài' })
  @IsNotEmpty({ message: 'Tên gói không được để trống' })
  @IsString({ message: 'Tên gói không hợp lệ' })
  name: string;

  @IsIn(PLAN_DURATION_MONTHS, {
    message: `Thời hạn chỉ được là ${PLAN_DURATION_MONTHS.join(', ')} tháng`,
  })
  durationMonths: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(1000, { message: 'Mô tả quá dài' })
  @IsString({ message: 'Mô tả không hợp lệ' })
  @IsOptional()
  description?: string;

  @Max(MAX_INT, { message: 'Giá quá lớn' })
  @Min(1, { message: 'Giá phải lớn hơn 0' })
  @IsInt({ message: 'Giá phải là số nguyên' })
  price: number;

  @Max(MAX_INT, { message: 'Số sách tối đa quá lớn' })
  @Min(0, { message: 'Số sách tối đa không được âm' })
  @IsInt({ message: 'Số sách tối đa phải là số nguyên' })
  bookLimit: number;

  @Max(MAX_INT, { message: 'Số biên tập viên tối đa quá lớn' })
  @Min(0, { message: 'Số biên tập viên tối đa không được âm' })
  @IsInt({ message: 'Số biên tập viên tối đa phải là số nguyên' })
  editorLimit: number;
}
