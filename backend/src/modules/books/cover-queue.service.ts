import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  COVER_QUEUE,
  CoverDestroyJobData,
  CoverJob,
} from './cover-queue.constants';

@Injectable()
export class CoverQueueService {
  private readonly logger = new Logger(CoverQueueService.name);

  constructor(
    @InjectQueue(COVER_QUEUE)
    private readonly queue: Queue<CoverDestroyJobData>,
  ) {}

  /**
   * Xóa ảnh bìa cũ trên Cloudinary (sách bị xóa, đổi hoặc gỡ bìa). Gọi sau commit;
   * không đẩy được job thì chỉ ghi log: ảnh mồ côi đã chấp nhận.
   */
  async enqueueDestroy(publicId: string | null | undefined): Promise<void> {
    if (!publicId) {
      return;
    }

    try {
      await this.queue.add(CoverJob.DESTROY, { publicId });
    } catch (error) {
      this.logger.error(
        `Không đẩy được job xóa ảnh ${publicId}: ${(error as Error).message}`,
      );
    }
  }
}
