import { IsNotEmpty, IsString } from 'class-validator';
import { IsPassword } from '../../../decorators/is-password.decorator';

export class ChangePasswordDto {
  @IsString({ message: 'Mật khẩu hiện tại không hợp lệ' })
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu hiện tại' })
  currentPassword: string;

  @IsPassword()
  newPassword: string;
}
