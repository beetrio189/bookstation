import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DEFAULT_JOB_OPTIONS } from '../../libs/bullmq.config';
import { MAINTENANCE_QUEUE } from './maintenance-queue.constants';
import { MaintenanceQueueService } from './maintenance-queue.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: MAINTENANCE_QUEUE,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    }),
  ],
  providers: [MaintenanceQueueService],
  exports: [BullModule, MaintenanceQueueService],
})
export class MaintenanceQueueModule {}
