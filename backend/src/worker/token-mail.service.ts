import { Injectable } from '@nestjs/common';
import {
  OneTimeTokenPurpose,
  OneTimeTokenService,
} from '../modules/auth/one-time-token.service';
import { MailJobData } from '../modules/mail/mail-queue.constants';
import { MailService } from '../modules/mail/mail.service';

export const VERIFY_EMAIL_TTL_SECONDS = 24 * 60 * 60;
export const RESET_PASSWORD_TTL_SECONDS = 24 * 60 * 60;

/**
 * Job mail kèm link một lần (xác thực email, đặt lại mật khẩu): tạo token lúc
 * gửi (không để token trong dữ liệu job ở Redis) rồi gửi link.
 */
@Injectable()
export class TokenMailService {
  constructor(
    private readonly oneTimeTokenService: OneTimeTokenService,
    private readonly mailService: MailService,
  ) {}

  async sendVerificationEmail({ userId, email }: MailJobData): Promise<void> {
    const token = await this.oneTimeTokenService.create(
      OneTimeTokenPurpose.VERIFY_EMAIL,
      userId,
      VERIFY_EMAIL_TTL_SECONDS,
    );

    await this.mailService.sendVerificationEmail(email, userId, token);
  }

  async sendPasswordResetEmail({ userId, email }: MailJobData): Promise<void> {
    const token = await this.oneTimeTokenService.create(
      OneTimeTokenPurpose.RESET_PASSWORD,
      userId,
      RESET_PASSWORD_TTL_SECONDS,
    );

    await this.mailService.sendPasswordResetEmail(email, userId, token);
  }
}
