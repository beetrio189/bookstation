import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException, ThrottlerStorage } from '@nestjs/throttler';
import { createHash } from 'crypto';
import { Request, Response } from 'express';

export const KEYED_THROTTLE_KEY = 'keyed-throttle';

export interface KeyedThrottleOptions {
  name: string;
  limit: number;
  ttl: number;
  getKey: (request: Request) => string | undefined;
}

/**
 * Giới hạn theo một key lấy từ request (IP + email, refresh token...), dùng
 * chung bộ đếm Redis với ThrottlerGuard. Giới hạn theo IP thì vẫn để
 * ThrottlerGuard toàn cục lo.
 */
@Injectable()
export class KeyedThrottlerGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ThrottlerStorage) private readonly storage: ThrottlerStorage,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<KeyedThrottleOptions | undefined>(
      KEYED_THROTTLE_KEY,
      context.getHandler(),
    );
    const http = context.switchToHttp();
    const value = options?.getKey(http.getRequest<Request>());

    if (!options || value === undefined) {
      return true;
    }

    const key = createHash('sha256')
      .update(
        [
          context.getClass().name,
          context.getHandler().name,
          options.name,
          value,
        ].join(':'),
      )
      .digest('hex');
    const { isBlocked, timeToBlockExpire } = await this.storage.increment(
      key,
      options.ttl,
      options.limit,
      options.ttl,
      options.name,
    );

    if (isBlocked) {
      http
        .getResponse<Response>()
        .header('Retry-After', String(timeToBlockExpire));
      throw new ThrottlerException();
    }

    return true;
  }
}
