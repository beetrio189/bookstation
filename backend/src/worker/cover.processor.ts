import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { destroyCover } from '../modules/books/cover';
import {
  COVER_QUEUE,
  CoverDestroyJobData,
  CoverJob,
} from '../modules/books/cover-queue.constants';

// Xóa ảnh bìa trên Cloudinary; hết lượt thử thì bỏ, ảnh thành mồ côi (chấp nhận)
@Processor(COVER_QUEUE)
export class CoverProcessor extends WorkerHost {
  private readonly logger = new Logger(CoverProcessor.name);

  async process(job: Job<CoverDestroyJobData>): Promise<void> {
    switch (job.name) {
      case CoverJob.DESTROY:
        return destroyCover(job.data.publicId);
      default:
        throw new Error(`Không có xử lý cho job ${job.name}`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<CoverDestroyJobData> | undefined, error: Error) {
    this.logger.error(
      `Xóa ảnh ${job?.data.publicId} lỗi lần ${job?.attemptsMade}: ${error.message}`,
    );
  }
}
