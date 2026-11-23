import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  AccountCredentialsJobData,
  AccountType,
} from '../modules/mail/mail-queue.constants';
import { MailService } from '../modules/mail/mail.service';
import { UsersService } from '../modules/users/users.service';
import { generatePassword, hashPassword } from '../utils/password';

/**
 * Job mail kèm mật khẩu mới do hệ thống cấp: tạo tài khoản (ACCOUNT_CREDENTIALS)
 * và admin reset mật khẩu (ACCOUNT_PASSWORD_RESET).
 */
@Injectable()
export class NewPasswordMailService {
  private readonly logger = new Logger(NewPasswordMailService.name);

  constructor(
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
  ) {}

  sendAccountCredentials(job: Job<AccountCredentialsJobData>): Promise<void> {
    return this.sendNewPassword(job, (email, accountType, password) =>
      this.mailService.sendAccountCredentialsEmail(
        email,
        accountType,
        password,
      ),
    );
  }

  sendAccountPasswordReset(job: Job<AccountCredentialsJobData>): Promise<void> {
    return this.sendNewPassword(job, (email, accountType, password) =>
      this.mailService.sendAccountPasswordResetEmail(
        email,
        accountType,
        password,
        job.data.reason,
      ),
    );
  }

  /**
   * Mỗi lần chạy (kể cả chạy lại sau lỗi) sinh mật khẩu mới rồi mới gửi:
   * mail gửi thành công cuối cùng luôn khớp mật khẩu trong DB.
   * Lần thử cuối vẫn lỗi thì xóa mật khẩu vừa đặt (không ai biết nó), để
   * hasPassword = false báo admin cần reset lại.
   */
  private async sendNewPassword(
    job: Job<AccountCredentialsJobData>,
    sendEmail: (
      email: string,
      accountType: AccountType,
      password: string,
    ) => Promise<void>,
  ): Promise<void> {
    const { userId, email, accountType } = job.data;
    const password = generatePassword();
    const passwordHash = await hashPassword(password);
    const isSet = await this.usersService.setLocalPasswordHash(
      userId,
      passwordHash,
    );

    if (!isSet) {
      this.logger.warn(`Bỏ job gửi mật khẩu: user ${userId} không còn`);
      return;
    }

    try {
      await sendEmail(email, accountType, password);
    } catch (error) {
      const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);

      if (isLastAttempt) {
        await this.usersService.clearLocalPasswordHash(userId, passwordHash);
      }

      throw error;
    }
  }
}
