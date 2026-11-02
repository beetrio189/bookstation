import { IsNormalizedEmail } from '../../../decorators/is-normalized-email.decorator';

export class ForgotPasswordDto {
  @IsNormalizedEmail()
  email: string;
}
