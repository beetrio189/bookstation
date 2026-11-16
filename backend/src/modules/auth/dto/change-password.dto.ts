import { IsNewPassword } from '../../../decorators/is-password.decorator';

export class ChangePasswordDto {
  @IsNewPassword()
  currentPassword: string;

  @IsNewPassword()
  newPassword: string;
}
