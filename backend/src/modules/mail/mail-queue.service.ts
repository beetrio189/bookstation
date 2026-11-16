import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  AccountCredentialsJobData,
  AccountType,
  MAIL_QUEUE,
  MailJob,
  MailJobData,
  PasswordChangedJobData,
} from './mail-queue.constants';

@Injectable()
export class MailQueueService {
  constructor(
    @InjectQueue(MAIL_QUEUE)
    private readonly queue: Queue<MailJobData>,
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
  ): Promise<void> {
    const data: AccountCredentialsJobData = { userId, email, accountType };

    await this.queue.add(MailJob.ACCOUNT_PASSWORD_RESET, data);
  }
}
