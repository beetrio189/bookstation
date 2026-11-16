import { IsNormalizedEmail } from '../../../decorators/is-normalized-email.decorator';
import { IsNewPassword } from '../../../decorators/is-password.decorator';

export class LoginDto {
  @IsNormalizedEmail()
  email: string;

  @IsNewPassword()
  password: string;
}
