import {
  IsNewPassword,
  IsPassword,
} from '../../../decorators/is-password.decorator';

export class ChangePasswordDto {
  @IsPassword()
  currentPassword: string;

  @IsNewPassword()
  newPassword: string;
}
