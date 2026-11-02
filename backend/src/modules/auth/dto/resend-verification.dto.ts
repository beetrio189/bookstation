import { IsNormalizedEmail } from '../../../decorators/is-normalized-email.decorator';

export class ResendVerificationDto {
  @IsNormalizedEmail()
  email: string;
}
