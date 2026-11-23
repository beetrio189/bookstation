import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailQueueModule } from '../mail/mail-queue.module';
import { Plan } from './entities/plan.entity';
import { SepayIpnController } from './sepay-ipn.controller';
import { SepayIpnService } from './sepay-ipn.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Plan]), MailQueueModule],
  controllers: [SubscriptionsController, SepayIpnController],
  providers: [SubscriptionsService, SepayIpnService],
})
export class SubscriptionsModule {}
