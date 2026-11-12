import { IsPassword } from '../../../decorators/is-password.decorator';

export class ChangePasswordDto {
  @IsPassword()
  currentPassword: string;

  @IsPassword()
  newPassword: string;
}
