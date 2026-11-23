import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  AccountCredentialsJobData,
  AccountDeletedJobData,
  MAIL_QUEUE,
  MailJob,
  MailJobData,
  PasswordChangedJobData,
  PaymentReceiptJobData,
  PaymentSettleAlertJobData,
  PlanDeletedNoticeJobData,
  PlanUpdatedJobData,
  PlanUpdatedNoticeJobData,
  PublisherStatusJobData,
} from '../modules/mail/mail-queue.constants';
import { MailService } from '../modules/mail/mail.service';
import { NewPasswordMailService } from './new-password-mail.service';
import { PaymentReceiptService } from './payment-receipt.service';
import { PlanNoticeService } from './plan-notice.service';
import { TokenMailService } from './token-mail.service';

// Giới hạn 2req/s cho con resend (đọc trên doc thì hình như max là 10req/s?)
@Processor(MAIL_QUEUE, {
  concurrency: 2,
  limiter: { max: 2, duration: 1000 },
})
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(
    private readonly mailService: MailService,
    private readonly tokenMailService: TokenMailService,
    private readonly newPasswordMailService: NewPasswordMailService,
    private readonly planNoticeService: PlanNoticeService,
    private readonly paymentReceiptService: PaymentReceiptService,
  ) {
    super();
  }

  async process(job: Job<MailJobData>): Promise<void> {
    switch (job.name) {
      case MailJob.VERIFY_EMAIL:
        return this.tokenMailService.sendVerificationEmail(job.data);
      case MailJob.RESET_PASSWORD:
        return this.tokenMailService.sendPasswordResetEmail(job.data);
      case MailJob.PASSWORD_CHANGED: {
        const { email, changedAt } = job.data as PasswordChangedJobData;

        return this.mailService.sendPasswordChangedEmail(
          email,
          new Date(changedAt),
        );
      }
      case MailJob.ACCOUNT_CREDENTIALS:
        return this.newPasswordMailService.sendAccountCredentials(
          job as Job<AccountCredentialsJobData>,
        );
      case MailJob.ACCOUNT_PASSWORD_RESET:
        return this.newPasswordMailService.sendAccountPasswordReset(
          job as Job<AccountCredentialsJobData>,
        );
      case MailJob.ACCOUNT_DELETED: {
        const { email, accountType } = job.data as AccountDeletedJobData;

        return this.mailService.sendAccountDeletedEmail(email, accountType);
      }
      case MailJob.PUBLISHER_SUSPENDED: {
        const { email, publisherName, reason } =
          job.data as PublisherStatusJobData;

        return this.mailService.sendPublisherSuspendedEmail(
          email,
          publisherName,
          reason,
        );
      }
      case MailJob.PUBLISHER_UNSUSPENDED: {
        const { email, publisherName, reason } =
          job.data as PublisherStatusJobData;

        return this.mailService.sendPublisherUnsuspendedEmail(
          email,
          publisherName,
          reason,
        );
      }
      case MailJob.PLAN_UPDATED:
        return this.planNoticeService.fanOutPlanUpdated(
          (job.data as unknown as PlanUpdatedJobData).planId,
        );
      case MailJob.PLAN_UPDATED_NOTICE: {
        const { email, plan, oldPlanName, periodEndsAt } =
          job.data as PlanUpdatedNoticeJobData;

        return this.mailService.sendPlanUpdatedEmail(
          email,
          plan,
          oldPlanName && periodEndsAt
            ? { planName: oldPlanName, periodEndsAt: new Date(periodEndsAt) }
            : undefined,
        );
      }
      case MailJob.PLAN_DELETED_NOTICE: {
        const { email, planName, periodEndsAt } =
          job.data as PlanDeletedNoticeJobData;

        return this.mailService.sendPlanDeletedEmail(
          email,
          planName,
          new Date(periodEndsAt),
        );
      }
      case MailJob.PAYMENT_RECEIPT:
        return this.paymentReceiptService.send(
          (job.data as unknown as PaymentReceiptJobData).paymentId,
        );
      case MailJob.PAYMENT_SETTLE_ALERT: {
        const { email, failingSince, ...alert } =
          job.data as PaymentSettleAlertJobData;

        return this.mailService.sendPaymentSettleAlertEmail(email, {
          ...alert,
          failingSince: new Date(failingSince),
        });
      }
      default:
        throw new Error(`Không có xử lý cho job ${job.name}`);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<MailJobData>) {
    this.logger.log(
      job.data.userId
        ? `Job ${job.name} (${job.id}) gửi xong cho user ${job.data.userId}`
        : `Job ${job.name} (${job.id}) xong`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error) {
    this.logger.error(
      `Job ${job?.name} (${job?.id}) lỗi lần ${job?.attemptsMade}: ${error.message}`,
    );
  }
}
