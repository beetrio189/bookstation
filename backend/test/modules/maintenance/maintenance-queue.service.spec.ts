import { Queue } from 'bullmq';
import { MaintenanceJob } from '../../../src/modules/maintenance/maintenance-queue.constants';
import { MaintenanceQueueService } from '../../../src/modules/maintenance/maintenance-queue.service';

describe('MaintenanceQueueService', () => {
  it('schedules the cleanup at midnight Vietnam time with retries', async () => {
    const queue = { upsertJobScheduler: jest.fn() };

    await new MaintenanceQueueService(
      queue as unknown as Queue,
    ).onApplicationBootstrap();

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      MaintenanceJob.DELETE_EXPIRED_REFRESH_TOKENS,
      { pattern: '0 0 * * *', tz: 'Asia/Ho_Chi_Minh' },
      {
        name: MaintenanceJob.DELETE_EXPIRED_REFRESH_TOKENS,
        opts: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
          removeOnFail: { age: 7 * 24 * 3600 },
        },
      },
    );
  });
});
