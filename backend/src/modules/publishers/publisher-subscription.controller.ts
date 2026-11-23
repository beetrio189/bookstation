import { Controller, Get, Header } from '@nestjs/common';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { Roles } from '../../decorators/roles.decorator';
import { RoleCode } from '../../utils/enums/role-code.enum';
import type { AuthUser } from '../../utils/types/auth-user';
import { PublisherSubscriptionService } from './publisher-subscription.service';

@Roles(RoleCode.PUBLISHER, RoleCode.EDITOR)
@Controller('publisher/subscription')
export class PublisherSubscriptionController {
  constructor(
    private readonly publisherSubscriptionService: PublisherSubscriptionService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  getCurrent(@CurrentUser() user: AuthUser) {
    return this.publisherSubscriptionService.getCurrent(user.id);
  }
}
