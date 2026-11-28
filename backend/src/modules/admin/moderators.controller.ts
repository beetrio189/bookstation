import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { IdParam } from '../../decorators/id-param.decorator';
import { Roles } from '../../decorators/roles.decorator';
import { RoleCode } from '../../utils/enums/role-code.enum';
import type { AuthUser } from '../../utils/types/auth-user';
import { ActionNoteDto } from './dto/action-note.dto';
import { CreateModeratorDto } from './dto/create-moderator.dto';
import { ModeratorsService } from './moderators.service';

@Controller('admin/moderators')
export class ModeratorsController {
  constructor(private readonly moderatorsService: ModeratorsService) {}

  @Roles(RoleCode.ADMIN)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateModeratorDto) {
    return this.moderatorsService.create(user.id, dto);
  }

  @Roles(RoleCode.ADMIN, RoleCode.MODERATOR)
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.moderatorsService.list(user.role);
  }

  @Roles(RoleCode.ADMIN)
  @Get(':id')
  findOne(@IdParam() id: string) {
    return this.moderatorsService.findOne(id);
  }

  @Roles(RoleCode.ADMIN)
  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @IdParam() id: string,
    @Body() dto: ActionNoteDto,
  ) {
    return this.moderatorsService.remove(user.id, id, dto.note);
  }

  @Roles(RoleCode.ADMIN)
  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @CurrentUser() user: AuthUser,
    @IdParam() id: string,
    @Body() dto: ActionNoteDto,
  ) {
    return this.moderatorsService.resetPassword(user.id, id, dto.note);
  }
}
