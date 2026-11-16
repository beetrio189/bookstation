import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { MailQueueModule } from '../mail/mail-queue.module';
import { SystemLog } from '../system-logs/entities/system-log.entity';
import { Provider } from '../users/entities/provider.entity';
import { User } from '../users/entities/user.entity';
import { ModeratorsController } from './moderators.controller';
import { ModeratorsService } from './moderators.service';

// Các API quản trị: /api/admin/*
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Provider, SystemLog, RefreshToken]),
    MailQueueModule,
  ],
  controllers: [ModeratorsController],
  providers: [ModeratorsService],
})
export class AdminModule {}
