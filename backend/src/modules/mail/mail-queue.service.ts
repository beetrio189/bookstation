import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  MAIL_QUEUE,
  MailJob,
  VerifyEmailJobData,
} from './mail-queue.constants';

@Injectable()
export class MailQueueService {
  constructor(
    @InjectQueue(MAIL_QUEUE)
    private readonly queue: Queue<VerifyEmailJobData>,
  ) {}

  async enqueueVerificationEmail(userId: string, email: string): Promise<void> {
    await this.queue.add(MailJob.VERIFY_EMAIL, { userId, email });
  }
}
