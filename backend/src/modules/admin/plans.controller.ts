import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { IdParam } from '../../decorators/id-param.decorator';
import { Roles } from '../../decorators/roles.decorator';
import { RoleCode } from '../../utils/enums/role-code.enum';
import type { AuthUser } from '../../utils/types/auth-user';
import { RequiredNoteDto } from './dto/required-note.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlansService } from './plans.service';

@Roles(RoleCode.ADMIN)
@Controller('admin/plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePlanDto) {
    return this.plansService.create(user.id, dto);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  list() {
    return this.plansService.list();
  }

  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  update(
    @CurrentUser() user: AuthUser,
    @IdParam() id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.plansService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @IdParam() id: string,
    @Body() dto: RequiredNoteDto,
  ) {
    return this.plansService.remove(user.id, id, dto);
  }
}
