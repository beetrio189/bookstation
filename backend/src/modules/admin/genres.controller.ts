import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { IdParam } from '../../decorators/id-param.decorator';
import { Roles } from '../../decorators/roles.decorator';
import { SearchPageQuery } from '../../utils/dto/search-page.query';
import { RoleCode } from '../../utils/enums/role-code.enum';
import type { AuthUser } from '../../utils/types/auth-user';
import { GenreFieldsDto } from '../genres/dto/genre-fields.dto';
import { GenresService } from '../genres/genres.service';
import { ActionNoteDto } from './dto/action-note.dto';

@Roles(RoleCode.ADMIN, RoleCode.MODERATOR)
@Controller('admin/genres')
export class AdminGenresController {
  constructor(private readonly genresService: GenresService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Query() query: SearchPageQuery) {
    return this.genresService.list(query, true);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: GenreFieldsDto) {
    return this.genresService.create(user.id, dto);
  }

  @Put(':id')
  @Header('Cache-Control', 'no-store')
  update(
    @CurrentUser() user: AuthUser,
    @IdParam() id: string,
    @Body() dto: GenreFieldsDto,
  ) {
    return this.genresService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @IdParam() id: string,
    @Body() dto: ActionNoteDto,
  ) {
    return this.genresService.remove(user.id, id, dto.note);
  }
}
