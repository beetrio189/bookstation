import { Controller, Get, Header, Query } from '@nestjs/common';
import { Public } from '../../decorators/public.decorator';
import { SearchPageQuery } from '../../utils/dto/search-page.query';
import { GenresService } from './genres.service';

@Controller('genres')
export class GenresController {
  constructor(private readonly genresService: GenresService) {}

  @Public()
  @Get()
  @Header('Cache-Control', 'public, max-age=300')
  list(@Query() query: SearchPageQuery) {
    return this.genresService.list(query);
  }
}
