import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { minutes, Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { IdParam } from '../../decorators/id-param.decorator';
import { Roles } from '../../decorators/roles.decorator';
import { RoleCode } from '../../utils/enums/role-code.enum';
import type { AuthUser } from '../../utils/types/auth-user';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PublisherPaymentsService } from './publisher-payments.service';

@Roles(RoleCode.PUBLISHER)
@Controller('publisher/payments')
export class PublisherPaymentsController {
  constructor(
    private readonly publisherPaymentsService: PublisherPaymentsService,
  ) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto) {
    return this.publisherPaymentsService.create(user.id, dto.planId);
  }

  @Post(':id/checkout')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  checkout(@CurrentUser() user: AuthUser, @IdParam() id: string) {
    return this.publisherPaymentsService.checkout(user.id, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: minutes(1), limit: 5 } })
  @Header('Cache-Control', 'no-store')
  cancel(@CurrentUser() user: AuthUser, @IdParam() id: string) {
    return this.publisherPaymentsService.cancel(user.id, id);
  }

  @Get('pending')
  @Header('Cache-Control', 'no-store')
  findPending(@CurrentUser() user: AuthUser) {
    return this.publisherPaymentsService.findPending(user.id);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  findOne(@CurrentUser() user: AuthUser, @IdParam() id: string) {
    return this.publisherPaymentsService.findOne(user.id, id);
  }
}
