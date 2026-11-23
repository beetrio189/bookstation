import { Module } from '@nestjs/common';
import { MailQueueModule } from '../mail/mail-queue.module';
import { PublisherPaymentsController } from './publisher-payments.controller';
import { PublisherPaymentsService } from './publisher-payments.service';
import { PublisherPlansController } from './publisher-plans.controller';
import { PublisherPlansService } from './publisher-plans.service';
import { PublisherSubscriptionController } from './publisher-subscription.controller';
import { PublisherSubscriptionService } from './publisher-subscription.service';

// Khu /publisher/* (NXB và biên tập viên)
@Module({
  imports: [MailQueueModule],
  controllers: [
    PublisherSubscriptionController,
    PublisherPlansController,
    PublisherPaymentsController,
  ],
  providers: [
    PublisherSubscriptionService,
    PublisherPlansService,
    PublisherPaymentsService,
  ],
})
export class PublishersModule {}
