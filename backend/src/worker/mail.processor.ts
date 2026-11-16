import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  OneTimeTokenPurpose,
  OneTimeTokenService,
} from '../modules/auth/one-time-token.service';
import {
  AccountCredentialsJobData,
  AccountType,
  MAIL_QUEUE,
  MailJob,
  MailJobData,
  PasswordChangedJobData,
} from '../modules/mail/mail-queue.constants';
import { MailService } from '../modules/mail/mail.service';
import { UsersService } from '../modules/users/users.service';
import { generatePassword, hashPassword } from '../utils/password';

export const VERIFY_EMAIL_TTL_SECONDS = 24 * 60 * 60;
export const RESET_PASSWORD_TTL_SECONDS = 24 * 60 * 60;

// Giới hạn 2req/s cho con resend (đọc trên doc thì hình như max là 10req/s?)
@Processor(MAIL_QUEUE, {
  concurrency: 2,
  limiter: { max: 2, duration: 1000 },
})
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(
    private readonly oneTimeTokenService: OneTimeTokenService,
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
  ) {
    super();
  }

  async process(job: Job<MailJobData>): Promise<void> {
    switch (job.name) {
      case MailJob.VERIFY_EMAIL:
        return this.sendVerificationEmail(job.data);
      case MailJob.RESET_PASSWORD:
        return this.sendPasswordResetEmail(job.data);
      case MailJob.PASSWORD_CHANGED:
        return this.sendPasswordChangedEmail(
          job.data as PasswordChangedJobData,
        );
      case MailJob.ACCOUNT_CREDENTIALS:
        return this.sendNewPassword(
          job as Job<AccountCredentialsJobData>,
          (email, accountType, password) =>
            this.mailService.sendAccountCredentialsEmail(
              email,
              accountType,
              password,
            ),
        );
      case MailJob.ACCOUNT_PASSWORD_RESET:
        return this.sendNewPassword(
          job as Job<AccountCredentialsJobData>,
          (email, accountType, password) =>
            this.mailService.sendAccountPasswordResetEmail(
              email,
              accountType,
              password,
            ),
        );
      default:
        throw new Error(`Không có xử lý cho job ${job.name}`);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<MailJobData>) {
    this.logger.log(
      `Job ${job.name} (${job.id}) gửi xong cho user ${job.data.userId}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error) {
    this.logger.error(
      `Job ${job?.name} (${job?.id}) lỗi lần ${job?.attemptsMade}: ${error.message}`,
    );
  }

  private async sendVerificationEmail({
    userId,
    email,
  }: MailJobData): Promise<void> {
    const token = await this.oneTimeTokenService.create(
      OneTimeTokenPurpose.VERIFY_EMAIL,
      userId,
      VERIFY_EMAIL_TTL_SECONDS,
    );

    await this.mailService.sendVerificationEmail(email, userId, token);
  }

  private async sendPasswordResetEmail({
    userId,
    email,
  }: MailJobData): Promise<void> {
    const token = await this.oneTimeTokenService.create(
      OneTimeTokenPurpose.RESET_PASSWORD,
      userId,
      RESET_PASSWORD_TTL_SECONDS,
    );

    await this.mailService.sendPasswordResetEmail(email, userId, token);
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

  private sendPasswordChangedEmail({
    email,
    changedAt,
  }: PasswordChangedJobData): Promise<void> {
    return this.mailService.sendPasswordChangedEmail(
      email,
      new Date(changedAt),
    );
  }
}
