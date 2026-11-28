import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { IdParam } from '../../decorators/id-param.decorator';
import { Roles } from '../../decorators/roles.decorator';
import { RoleCode } from '../../utils/enums/role-code.enum';
import type { AuthUser } from '../../utils/types/auth-user';
import { ActionNoteDto } from '../admin/dto/action-note.dto';
import { CreateEditorDto } from './dto/create-editor.dto';
import { PublisherEditorsService } from './publisher-editors.service';

@Controller('publisher/editors')
export class PublisherEditorsController {
  constructor(
    private readonly publisherEditorsService: PublisherEditorsService,
  ) {}

  @Get()
  @Roles(RoleCode.PUBLISHER, RoleCode.EDITOR)
  @Header('Cache-Control', 'no-store')
  list(@CurrentUser() user: AuthUser) {
    return this.publisherEditorsService.list(user);
  }

  @Post()
  @Roles(RoleCode.PUBLISHER)
  create(@CurrentUser() user: AuthUser, @Body() body: CreateEditorDto) {
    return this.publisherEditorsService.create(user, body);
  }

  @Get(':id')
  @Roles(RoleCode.PUBLISHER)
  @Header('Cache-Control', 'no-store')
  findOne(@CurrentUser() user: AuthUser, @IdParam() id: string) {
    return this.publisherEditorsService.findOne(user, id);
  }

  @Delete(':id')
  @Roles(RoleCode.PUBLISHER)
  remove(
    @CurrentUser() user: AuthUser,
    @IdParam() id: string,
    @Body() dto: ActionNoteDto,
  ) {
    return this.publisherEditorsService.remove(user, id, dto.note);
  }

  @Post(':id/reset-password')
  @Roles(RoleCode.PUBLISHER)
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @CurrentUser() user: AuthUser,
    @IdParam() id: string,
    @Body() dto: ActionNoteDto,
  ) {
    return this.publisherEditorsService.resetPassword(user, id, dto.note);
  }
}
