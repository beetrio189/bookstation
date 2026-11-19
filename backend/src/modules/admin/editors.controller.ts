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
import { RequiredNoteDto } from './dto/required-note.dto';
import { EditorsService } from './editors.service';

@Roles(RoleCode.ADMIN, RoleCode.MODERATOR)
@Controller('admin/editors')
export class EditorsController {
  constructor(private readonly editorsService: EditorsService) {}

  @Get(':id')
  findOne(@IdParam() id: string) {
    return this.editorsService.findOne(id);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @IdParam() id: string,
    @Body() { note }: RequiredNoteDto,
  ) {
    return this.editorsService.remove(user.id, id, note);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @CurrentUser() user: AuthUser,
    @IdParam() id: string,
    @Body() { note }: RequiredNoteDto,
  ) {
    return this.editorsService.resetPassword(user.id, id, note);
  }
}
