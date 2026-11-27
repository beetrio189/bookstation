import { NormalizeText } from '../../../decorators/normalize-text.decorator';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsNormalizedEmail } from '../../../decorators/is-normalized-email.decorator';
import { IsNewPassword } from '../../../decorators/is-password.decorator';

export class RegisterDto {
  @IsNormalizedEmail()
  email: string;

  @IsNewPassword()
  password: string;

  @NormalizeText()
  @MaxLength(100, { message: 'Tên hiển thị quá dài' })
  @IsNotEmpty({ message: 'Tên hiển thị không được để trống' })
  @IsString({ message: 'Tên hiển thị không hợp lệ' })
  name: string;
}
