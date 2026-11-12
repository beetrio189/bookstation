import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BULLMQ_ROOT_OPTIONS } from '../libs/bullmq.config';
import dataSource from '../libs/typeorm.config';
import { RefreshToken } from '../modules/auth/entities/refresh-token.entity';
import { OneTimeTokenService } from '../modules/auth/one-time-token.service';
import { RefreshTokenService } from '../modules/auth/refresh-token.service';
import { MailQueueModule } from '../modules/mail/mail-queue.module';
import { MailModule } from '../modules/mail/mail.module';
import { MaintenanceQueueModule } from '../modules/maintenance/maintenance-queue.module';
import { RedisModule } from '../modules/redis/redis.module';
import { MailProcessor } from './mail.processor';
import { MaintenanceProcessor } from './maintenance.processor';

// Root module của worker: không có HTTP, controller hay guard, chỉ xử lý job
@Module({
  imports: [
    TypeOrmModule.forRoot({ ...dataSource.options, autoLoadEntities: true }),
    TypeOrmModule.forFeature([RefreshToken]),
    BullModule.forRoot(BULLMQ_ROOT_OPTIONS),
    RedisModule,
    MailModule,
    MailQueueModule,
    MaintenanceQueueModule,
  ],
  providers: [
    MailProcessor,
    OneTimeTokenService,
    MaintenanceProcessor,
    RefreshTokenService,
  ],
})
export class WorkerModule {}
