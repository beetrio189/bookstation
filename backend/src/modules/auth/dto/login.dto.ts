import { IsNotEmpty, IsString } from 'class-validator';
import { IsNormalizedEmail } from '../../../decorators/is-normalized-email.decorator';

export class LoginDto {
  @IsNormalizedEmail()
  email: string;

  @IsString({ message: 'Mật khẩu không hợp lệ' })
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu' })
  password: string;
}
