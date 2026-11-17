import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Ghi chú bắt buộc (hành động trên NXB/biên tập viên): lưu vào system_logs.note
export class RequiredNoteDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(1000, { message: 'Ghi chú quá dài' })
  @IsNotEmpty({ message: 'Ghi chú không được để trống' })
  @IsString({ message: 'Ghi chú không hợp lệ' })
  note: string;
}
