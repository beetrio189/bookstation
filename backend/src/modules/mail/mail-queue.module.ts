import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DEFAULT_JOB_OPTIONS } from '../../libs/bullmq.config';
import { MAIL_QUEUE } from './mail-queue.constants';
import { MailQueueService } from './mail-queue.service';

// Dùng chung cho API (đẩy job) và worker (lấy job)
@Module({
  imports: [
    BullModule.registerQueue({
      name: MAIL_QUEUE,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    }),
  ],
  providers: [MailQueueService],
  exports: [BullModule, MailQueueService],
})
export class MailQueueModule {}
