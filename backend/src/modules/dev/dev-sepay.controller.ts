import { Body, Controller, Header, Post } from '@nestjs/common';
import { IsInt, Max, Min } from 'class-validator';
import { env } from '../../config';
import { Public } from '../../decorators/public.decorator';
import {
  buildCheckoutForm,
  generateOrderCode,
} from '../subscriptions/sepay-checkout';

class SepayCheckoutDto {
  @IsInt()
  @Min(2000)
  @Max(100_000_000)
  amount: number;
}

// MẪU THỬ cổng SePay (chỉ đăng ký khi không phải production): ký form để FE /dev/sepay
// gửi sang trang thanh toán sandbox. Không tạo đơn trong DB; IPN xem trên webhook.site.
@Controller('dev/sepay-checkout')
export class DevSepayController {
  @Public()
  @Post()
  @Header('Cache-Control', 'no-store')
  create(@Body() { amount }: SepayCheckoutDto) {
    const orderCode = generateOrderCode('BS');
    const result = (kind: string) =>
      `${env.feUrl}/dev/sepay?${new URLSearchParams({ result: kind, order: orderCode }).toString()}`;

    return buildCheckoutForm({
      orderCode,
      amount,
      description: `Thanh toan don hang ${orderCode}`,
      successUrl: result('success'),
      errorUrl: result('error'),
      cancelUrl: result('cancel'),
    });
  }
}
