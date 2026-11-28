import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { IdParam } from '../../decorators/id-param.decorator';
import { Roles } from '../../decorators/roles.decorator';
import { RoleCode } from '../../utils/enums/role-code.enum';
import type { AuthUser } from '../../utils/types/auth-user';
import { CreatePublisherDto } from './dto/create-publisher.dto';
import { SearchPageQuery } from '../../utils/dto/search-page.query';
import { RequiredNoteDto } from './dto/required-note.dto';
import { PublishersService } from './publishers.service';

// Admin và KDV làm được mọi thao tác trên NXB, trừ xóa (chỉ admin). :id là publishers.id
@Roles(RoleCode.ADMIN, RoleCode.MODERATOR)
@Controller('admin/publishers')
export class PublishersController {
  constructor(private readonly publishersService: PublishersService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePublisherDto) {
    return this.publishersService.create(user.id, dto);
  }

  @Get()
  list(@Query() query: SearchPageQuery) {
    return this.publishersService.list(query);
  }

  @Get(':id')
  findOne(@IdParam() id: string) {
    return this.publishersService.findOne(id);
  }

  @Get(':id/editors')
  listEditors(@IdParam() id: string) {
    return this.publishersService.listEditors(id);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @CurrentUser() user: AuthUser,
    @IdParam() id: string,
    @Body() dto: RequiredNoteDto,
  ) {
    return this.publishersService.resetPassword(user.id, id, dto.note);
  }

  @Post(':id/lock')
  @HttpCode(HttpStatus.OK)
  lock(
    @CurrentUser() user: AuthUser,
    @IdParam() id: string,
    @Body() dto: RequiredNoteDto,
  ) {
    return this.publishersService.lock(user.id, id, dto.note);
  }

  @Delete(':id')
  @Roles(RoleCode.ADMIN)
  remove(
    @CurrentUser() user: AuthUser,
    @IdParam() id: string,
    @Body() dto: RequiredNoteDto,
  ) {
    return this.publishersService.remove(user.id, id, dto.note);
  }

  @Post(':id/unlock')
  @HttpCode(HttpStatus.OK)
  unlock(
    @CurrentUser() user: AuthUser,
    @IdParam() id: string,
    @Body() dto: RequiredNoteDto,
  ) {
    return this.publishersService.unlock(user.id, id, dto.note);
  }
}
