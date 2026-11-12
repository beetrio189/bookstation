import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  OneTimeTokenPurpose,
  OneTimeTokenService,
} from '../modules/auth/one-time-token.service';
import {
  MAIL_QUEUE,
  MailJob,
  VerifyEmailJobData,
} from '../modules/mail/mail-queue.constants';
import { MailService } from '../modules/mail/mail.service';

export const VERIFY_EMAIL_TTL_SECONDS = 24 * 60 * 60;

// Giưới hạn 2req/s cho con resend (đọc trên doc thì hình như max là 10req/s?)
@Processor(MAIL_QUEUE, {
  concurrency: 2,
  limiter: { max: 2, duration: 1000 },
})
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(
    private readonly oneTimeTokenService: OneTimeTokenService,
    private readonly mailService: MailService,
  ) {
    super();
  }

  async process(job: Job<VerifyEmailJobData>): Promise<void> {
    switch (job.name) {
      case MailJob.VERIFY_EMAIL:
        return this.sendVerificationEmail(job.data);
      default:
        throw new Error(`Không có xử lý cho job ${job.name}`);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<VerifyEmailJobData>) {
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
  }: VerifyEmailJobData): Promise<void> {
    const token = await this.oneTimeTokenService.create(
      OneTimeTokenPurpose.VERIFY_EMAIL,
      userId,
      VERIFY_EMAIL_TTL_SECONDS,
    );

    await this.mailService.sendVerificationEmail(email, userId, token);
  }
}
