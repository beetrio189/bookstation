import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../../decorators/public.decorator';
import { SubscriptionsService } from './subscriptions.service';

@Controller('plans')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Public()
  @Get()
  @Header('Cache-Control', 'public, max-age=300')
  listPlans() {
    return this.subscriptionsService.listPlans();
  }
}
