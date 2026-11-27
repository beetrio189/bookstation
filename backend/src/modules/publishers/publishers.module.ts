import { Module } from '@nestjs/common';
import { CoverQueueModule } from '../books/cover-queue.module';
import { MailQueueModule } from '../mail/mail-queue.module';
import { PublisherBooksController } from './publisher-books.controller';
import { PublisherBooksService } from './publisher-books.service';
import { PublisherEditorsController } from './publisher-editors.controller';
import { PublisherEditorsService } from './publisher-editors.service';
import { PublisherPaymentsController } from './publisher-payments.controller';
import { PublisherPaymentsService } from './publisher-payments.service';
import { PublisherPlansController } from './publisher-plans.controller';
import { PublisherPlansService } from './publisher-plans.service';
import { PublisherSubscriptionController } from './publisher-subscription.controller';
import { PublisherSubscriptionService } from './publisher-subscription.service';

// Khu /publisher/* (NXB và biên tập viên)
@Module({
  imports: [MailQueueModule, CoverQueueModule],
  controllers: [
    PublisherSubscriptionController,
    PublisherPlansController,
    PublisherPaymentsController,
    PublisherEditorsController,
    PublisherBooksController,
  ],
  providers: [
    PublisherSubscriptionService,
    PublisherPlansService,
    PublisherPaymentsService,
    PublisherEditorsService,
    PublisherBooksService,
  ],
})
export class PublishersModule {}
