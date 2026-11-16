import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsNormalizedEmail } from '../../../decorators/is-normalized-email.decorator';

// Admin không nhập mật khẩu: worker tự sinh rồi gửi qua email
export class CreateModeratorDto {
  @IsNormalizedEmail()
  email: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(100, { message: 'Tên hiển thị quá dài' })
  @IsNotEmpty({ message: 'Tên hiển thị không được để trống' })
  @IsString({ message: 'Tên hiển thị không hợp lệ' })
  name: string;
}
