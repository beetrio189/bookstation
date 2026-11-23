import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { Public } from '../../decorators/public.decorator';
import { type SepayIpnBody, SepayIpnService } from './sepay-ipn.service';

@Controller('payments/sepay')
export class SepayIpnController {
  constructor(private readonly sepayIpnService: SepayIpnService) {}

  @Public()
  @Post('ipn')
  @HttpCode(HttpStatus.OK)
  ipn(
    @Headers('x-secret-key') secretKey: string | undefined,
    @Body() body: SepayIpnBody,
  ) {
    return this.sepayIpnService.handle(secretKey, body);
  }
}
