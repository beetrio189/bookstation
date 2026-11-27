import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DEFAULT_JOB_OPTIONS } from '../../libs/bullmq.config';
import { COVER_QUEUE } from './cover-queue.constants';
import { CoverQueueService } from './cover-queue.service';

// Dùng chung cho API (đẩy job) và worker (lấy job)
@Module({
  imports: [
    BullModule.registerQueue({
      name: COVER_QUEUE,
      // Cloudinary lỗi tạm thời thì thử lại lâu hơn mail một chút
      defaultJobOptions: {
        ...DEFAULT_JOB_OPTIONS,
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
      },
    }),
  ],
  providers: [CoverQueueService],
  exports: [BullModule, CoverQueueService],
})
export class CoverQueueModule {}
