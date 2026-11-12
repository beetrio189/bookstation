import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import {
  IP_EMAIL_THROTTLE_KEY,
  IpEmailThrottleOptions,
  IpEmailThrottlerGuard,
} from '../guards/ip-email-throttler.guard';

export const ThrottleByIpEmail = (options: IpEmailThrottleOptions) =>
  applyDecorators(
    SetMetadata(IP_EMAIL_THROTTLE_KEY, options),
    UseGuards(IpEmailThrottlerGuard),
  );
