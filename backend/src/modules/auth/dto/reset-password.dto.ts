import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { IsPassword } from '../../../decorators/is-password.decorator';

export class ResetPasswordDto {
  @IsUUID('all', { message: 'Mã đặt lại mật khẩu không hợp lệ' })
  uid: string;

  @IsString({ message: 'Mã đặt lại mật khẩu không hợp lệ' })
  @IsNotEmpty({ message: 'Thiếu mã đặt lại mật khẩu' })
  token: string;

  @IsPassword()
  newPassword: string;
}
