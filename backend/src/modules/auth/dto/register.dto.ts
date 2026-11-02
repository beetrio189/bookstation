import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsNormalizedEmail } from '../../../decorators/is-normalized-email.decorator';
import { IsPassword } from '../../../decorators/is-password.decorator';

export class RegisterDto {
  @IsNormalizedEmail()
  email: string;

  @IsPassword()
  password: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(100, { message: 'Tên hiển thị quá dài' })
  @IsNotEmpty({ message: 'Tên hiển thị không được để trống' })
  @IsString({ message: 'Tên hiển thị không hợp lệ' })
  displayName: string;
}
