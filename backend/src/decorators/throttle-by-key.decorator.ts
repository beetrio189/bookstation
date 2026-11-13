import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import {
  KEYED_THROTTLE_KEY,
  KeyedThrottleOptions,
  KeyedThrottlerGuard,
} from '../guards/keyed-throttler.guard';

export const ThrottleByKey = (options: KeyedThrottleOptions) =>
  applyDecorators(
    SetMetadata(KEYED_THROTTLE_KEY, options),
    UseGuards(KeyedThrottlerGuard),
  );
