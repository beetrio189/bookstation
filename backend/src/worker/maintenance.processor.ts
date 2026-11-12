import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RefreshTokenService } from '../modules/auth/refresh-token.service';
import {
  MAINTENANCE_QUEUE,
  MaintenanceJob,
} from '../modules/maintenance/maintenance-queue.constants';

@Processor(MAINTENANCE_QUEUE)
export class MaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(private readonly refreshTokenService: RefreshTokenService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case MaintenanceJob.DELETE_EXPIRED_REFRESH_TOKENS:
        return this.deleteExpiredRefreshTokens();
      default:
        throw new Error(`Không có xử lý cho job ${job.name}`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error) {
    this.logger.error(
      `Job ${job?.name} (${job?.id}) lỗi lần ${job?.attemptsMade}: ${error.message}`,
    );
  }

  private async deleteExpiredRefreshTokens(): Promise<void> {
    const deleted = await this.refreshTokenService.deleteExpired();

    this.logger.log(`Đã xóa ${deleted} refresh token hết hạn`);
  }
}
