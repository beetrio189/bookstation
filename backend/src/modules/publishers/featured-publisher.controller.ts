import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../../decorators/public.decorator';
import { FeaturedPublisherService } from './featured-publisher.service';

// API công khai về NXB cho trang độc giả (đặt theo tài nguyên, không theo role)
@Controller('publishers')
export class FeaturedPublisherController {
  constructor(
    private readonly featuredPublisherService: FeaturedPublisherService,
  ) {}

  @Public()
  @Get('featured')
  @Header('Cache-Control', 'public, max-age=300')
  featured() {
    return this.featuredPublisherService.get();
  }
}
