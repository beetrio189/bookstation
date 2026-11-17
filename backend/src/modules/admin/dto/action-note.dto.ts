import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

// Lý do của hành động quản trị, lưu vào system_logs.note. Không bắt buộc: thiếu thì là ""
export class ActionNoteDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(1000, { message: 'Ghi chú quá dài' })
  @IsString({ message: 'Ghi chú không hợp lệ' })
  @IsOptional()
  note: string = '';
}
