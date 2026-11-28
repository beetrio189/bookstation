import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { minutes, Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { IdParam } from '../../decorators/id-param.decorator';
import { Roles } from '../../decorators/roles.decorator';
import { RoleCode } from '../../utils/enums/role-code.enum';
import type { AuthUser } from '../../utils/types/auth-user';
import { ActionNoteDto } from '../admin/dto/action-note.dto';
import { BookDto } from './dto/book.dto';
import { ListPublisherBooksQuery } from './dto/list-publisher-books.query';
import { PublisherBooksService } from './publisher-books.service';

@Roles(RoleCode.PUBLISHER, RoleCode.EDITOR)
@Controller('publisher/books')
export class PublisherBooksController {
  constructor(private readonly publisherBooksService: PublisherBooksService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@CurrentUser() user: AuthUser, @Query() query: ListPublisherBooksQuery) {
    return this.publisherBooksService.list(user, query);
  }

  @Post('cover-upload')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: minutes(1), limit: 3 } })
  requestCoverUpload(@CurrentUser() user: AuthUser) {
    return this.publisherBooksService.requestCoverUpload(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: BookDto) {
    return this.publisherBooksService.create(user, dto);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  findOne(@CurrentUser() user: AuthUser, @IdParam() id: string) {
    return this.publisherBooksService.findOne(user, id);
  }

  @Put(':id')
  @Header('Cache-Control', 'no-store')
  update(
    @CurrentUser() user: AuthUser,
    @IdParam() id: string,
    @Body() dto: BookDto,
  ) {
    return this.publisherBooksService.update(user, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @IdParam() id: string,
    @Body() dto: ActionNoteDto,
  ) {
    return this.publisherBooksService.remove(user, id, dto.note);
  }
}
