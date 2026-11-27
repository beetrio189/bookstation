import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BULLMQ_ROOT_OPTIONS } from '../libs/bullmq.config';
import dataSource from '../libs/typeorm.config';
import { RefreshToken } from '../modules/auth/entities/refresh-token.entity';
import { OneTimeTokenService } from '../modules/auth/one-time-token.service';
import { RefreshTokenService } from '../modules/auth/refresh-token.service';
import { CoverQueueModule } from '../modules/books/cover-queue.module';
import { MailQueueModule } from '../modules/mail/mail-queue.module';
import { MailModule } from '../modules/mail/mail.module';
import { MaintenanceQueueModule } from '../modules/maintenance/maintenance-queue.module';
import { RedisModule } from '../modules/redis/redis.module';
import { Provider } from '../modules/users/entities/provider.entity';
import { User } from '../modules/users/entities/user.entity';
import { UsersService } from '../modules/users/users.service';
import { CoverProcessor } from './cover.processor';
import { ExpiredPaymentsService } from './expired-payments.service';
import { MailProcessor } from './mail.processor';
import { MaintenanceProcessor } from './maintenance.processor';
import { NewPasswordMailService } from './new-password-mail.service';
import { PaymentReceiptService } from './payment-receipt.service';
import { PlanNoticeService } from './plan-notice.service';
import { TokenMailService } from './token-mail.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({ ...dataSource.options, autoLoadEntities: true }),
    TypeOrmModule.forFeature([RefreshToken, User, Provider]),
    BullModule.forRoot(BULLMQ_ROOT_OPTIONS),
    RedisModule,
    MailModule,
    MailQueueModule,
    MaintenanceQueueModule,
    CoverQueueModule,
  ],
  providers: [
    MailProcessor,
    OneTimeTokenService,
    MaintenanceProcessor,
    CoverProcessor,
    RefreshTokenService,
    UsersService,
    PlanNoticeService,
    ExpiredPaymentsService,
    PaymentReceiptService,
    TokenMailService,
    NewPasswordMailService,
  ],
})
export class WorkerModule {}
