import { Controller, Get, Header } from '@nestjs/common';
import { IdParam } from '../../decorators/id-param.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { Roles } from '../../decorators/roles.decorator';
import { RoleCode } from '../../utils/enums/role-code.enum';
import type { AuthUser } from '../../utils/types/auth-user';
import { PublisherPlansService } from './publisher-plans.service';

@Roles(RoleCode.PUBLISHER)
@Controller('publisher/plans')
export class PublisherPlansController {
  constructor(private readonly publisherPlansService: PublisherPlansService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  listPlans(@CurrentUser() user: AuthUser) {
    return this.publisherPlansService.listPlans(user.id);
  }

  @Get(':id/quote')
  @Header('Cache-Control', 'no-store')
  quote(@CurrentUser() user: AuthUser, @IdParam() id: string) {
    return this.publisherPlansService.quote(user.id, id);
  }
}
