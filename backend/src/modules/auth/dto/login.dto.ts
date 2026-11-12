import { IsNormalizedEmail } from '../../../decorators/is-normalized-email.decorator';
import { IsPassword } from '../../../decorators/is-password.decorator';

export class LoginDto {
  @IsNormalizedEmail()
  email: string;

  @IsPassword()
  password: string;
}
