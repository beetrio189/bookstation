import { IsOptional } from 'class-validator';
import { ActionNoteDto } from './action-note.dto';
import {
  IsPlanDescription,
  IsPlanLimit,
  IsPlanName,
  IsPlanPrice,
} from './plan-fields';

/**
 * Sửa gói: gửi trường nào sửa trường đó, quy tắc như lúc tạo. Không sửa thời hạn
 * (ghim để lịch sử không lẫn); trường lạ (durationMonths…) bị bỏ. description ""
 * là xóa mô tả. Không có trường nào để sửa thì service báo NOTHING_TO_UPDATE.
 */
export class UpdatePlanDto extends ActionNoteDto {
  @IsPlanName()
  @IsOptional()
  name?: string;

  @IsPlanDescription()
  @IsOptional()
  description?: string;

  @IsPlanPrice()
  @IsOptional()
  price?: number;

  @IsPlanLimit('Số sách tối đa')
  @IsOptional()
  bookLimit?: number;

  @IsPlanLimit('Số biên tập viên tối đa')
  @IsOptional()
  editorLimit?: number;
}
