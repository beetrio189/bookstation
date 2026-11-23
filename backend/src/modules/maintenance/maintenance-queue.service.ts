import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DEFAULT_JOB_OPTIONS } from '../../libs/bullmq.config';
import {
  MAINTENANCE_QUEUE,
  MaintenanceJob,
} from './maintenance-queue.constants';

const EVERY_DAY_AT_MIDNIGHT = { pattern: '0 0 * * *', tz: 'Asia/Ho_Chi_Minh' };
const EVERY_MINUTE_MS = 60_000;

@Injectable()
export class MaintenanceQueueService implements OnApplicationBootstrap {
  constructor(
    @InjectQueue(MAINTENANCE_QUEUE)
    private readonly queue: Queue,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      MaintenanceJob.DELETE_EXPIRED_REFRESH_TOKENS,
      EVERY_DAY_AT_MIDNIGHT,
      {
        name: MaintenanceJob.DELETE_EXPIRED_REFRESH_TOKENS,
        opts: DEFAULT_JOB_OPTIONS,
      },
    );

    await this.queue.upsertJobScheduler(
      MaintenanceJob.SETTLE_EXPIRED_PAYMENTS,
      { every: EVERY_MINUTE_MS },
      {
        name: MaintenanceJob.SETTLE_EXPIRED_PAYMENTS,
        opts: { ...DEFAULT_JOB_OPTIONS, attempts: 1 },
      },
    );
  }
}
