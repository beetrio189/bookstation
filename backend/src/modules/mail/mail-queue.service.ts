import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  AccountCredentialsJobData,
  AccountDeletedJobData,
  AccountType,
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
} from './mail-queue.constants';

@Injectable()
export class MailQueueService {
  constructor(
    @InjectQueue(MAIL_QUEUE)
    private readonly queue: Queue<
      MailJobData | PlanUpdatedJobData | PaymentReceiptJobData
    >,
  ) {}

  async enqueueVerificationEmail(userId: string, email: string): Promise<void> {
    await this.queue.add(MailJob.VERIFY_EMAIL, { userId, email });
  }

  async enqueuePasswordResetEmail(
    userId: string,
    email: string,
  ): Promise<void> {
    await this.queue.add(MailJob.RESET_PASSWORD, { userId, email });
  }

  async enqueuePasswordChangedEmail(
    userId: string,
    email: string,
  ): Promise<void> {
    const data: PasswordChangedJobData = {
      userId,
      email,
      changedAt: new Date().toISOString(),
    };

    await this.queue.add(MailJob.PASSWORD_CHANGED, data);
  }

  async enqueueAccountCredentialsEmail(
    userId: string,
    email: string,
    accountType: AccountType,
  ): Promise<void> {
    const data: AccountCredentialsJobData = { userId, email, accountType };

    await this.queue.add(MailJob.ACCOUNT_CREDENTIALS, data);
  }

  async enqueueAccountPasswordResetEmail(
    userId: string,
    email: string,
    accountType: AccountType,
    reason?: string,
  ): Promise<void> {
    const data: AccountCredentialsJobData = {
      userId,
      email,
      accountType,
      ...(reason && { reason }),
    };

    await this.queue.add(MailJob.ACCOUNT_PASSWORD_RESET, data);
  }

  async enqueuePublisherStatusEmail(
    job: MailJob.PUBLISHER_SUSPENDED | MailJob.PUBLISHER_UNSUSPENDED,
    data: PublisherStatusJobData,
  ): Promise<void> {
    await this.queue.add(job, data);
  }

  async enqueueAccountDeletedEmail(
    userId: string,
    email: string,
    accountType: AccountType,
  ): Promise<void> {
    const data: AccountDeletedJobData = { userId, email, accountType };

    await this.queue.add(MailJob.ACCOUNT_DELETED, data);
  }

  async enqueuePlanUpdated(planId: string): Promise<void> {
    const data: PlanUpdatedJobData = { planId };

    await this.queue.add(MailJob.PLAN_UPDATED, data);
  }

  async enqueuePlanUpdatedNotices(
    notices: PlanUpdatedNoticeJobData[],
  ): Promise<void> {
    await this.queue.addBulk(
      notices.map((data) => ({ name: MailJob.PLAN_UPDATED_NOTICE, data })),
    );
  }

  async enqueuePlanDeletedNotices(
    notices: PlanDeletedNoticeJobData[],
  ): Promise<void> {
    await this.queue.addBulk(
      notices.map((data) => ({ name: MailJob.PLAN_DELETED_NOTICE, data })),
    );
  }

  async enqueuePaymentSettleAlerts(
    alerts: PaymentSettleAlertJobData[],
  ): Promise<void> {
    await this.queue.addBulk(
      alerts.map((data) => ({ name: MailJob.PAYMENT_SETTLE_ALERT, data })),
    );
  }

  /** Gọi sau khi transaction xác nhận đơn đã commit (worker đọc lại đơn từ DB) */
  async enqueuePaymentReceipt(paymentId: string): Promise<void> {
    const data: PaymentReceiptJobData = { paymentId };

    await this.queue.add(MailJob.PAYMENT_RECEIPT, data);
  }
}
