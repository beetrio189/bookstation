import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { Roles } from '../../decorators/roles.decorator';
import { RoleCode } from '../../utils/enums/role-code.enum';
import type { AuthUser } from '../../utils/types/auth-user';
import { CreatePlanDto } from './dto/create-plan.dto';
import { PlansService } from './plans.service';

@Roles(RoleCode.ADMIN)
@Controller('admin/plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePlanDto) {
    return this.plansService.create(user.id, dto);
  }
}
