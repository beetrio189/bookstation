import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Public } from '../../decorators/public.decorator';
import { AppException } from '../../utils/errors/app.exception';
import { ERRORS } from '../../utils/errors/errors';

@Public()
@Controller('health')
export class HealthCheckController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new AppException(ERRORS.SERVICE_UNAVAILABLE);
    }

    return { status: 'ok', database: 'up' };
  }
}
