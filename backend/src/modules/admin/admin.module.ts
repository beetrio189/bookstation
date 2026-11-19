import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { MailQueueModule } from '../mail/mail-queue.module';
import { Editor } from '../publishers/entities/editor.entity';
import { Publisher } from '../publishers/entities/publisher.entity';
import { Plan } from '../subscriptions/entities/plan.entity';
import { SystemLog } from '../system-logs/entities/system-log.entity';
import { Provider } from '../users/entities/provider.entity';
import { User } from '../users/entities/user.entity';
import { EditorsController } from './editors.controller';
import { EditorsService } from './editors.service';
import { ModeratorsController } from './moderators.controller';
import { ModeratorsService } from './moderators.service';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { PublishersController } from './publishers.controller';
import { PublishersService } from './publishers.service';

// Các API quản trị: /api/admin/*
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Provider,
      SystemLog,
      RefreshToken,
      Publisher,
      Editor,
      Plan,
    ]),
    MailQueueModule,
  ],
  controllers: [
    ModeratorsController,
    PublishersController,
    EditorsController,
    PlansController,
  ],
  providers: [
    ModeratorsService,
    PublishersService,
    EditorsService,
    PlansService,
  ],
})
export class AdminModule {}
