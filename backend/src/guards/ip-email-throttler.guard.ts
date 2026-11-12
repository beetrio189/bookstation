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

export const IP_EMAIL_THROTTLE_KEY = 'ip-email-throttle';
const THROTTLER_NAME = 'ip-email';

export interface IpEmailThrottleOptions {
  limit: number;
  ttl: number;
}

/**
 * Giới hạn theo cặp IP + email trong body, dùng chung bộ đếm Redis với
 * ThrottlerGuard. Giới hạn theo IP thì vẫn để ThrottlerGuard toàn cục lo.
 */
@Injectable()
export class IpEmailThrottlerGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ThrottlerStorage) private readonly storage: ThrottlerStorage,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<IpEmailThrottleOptions | undefined>(
      IP_EMAIL_THROTTLE_KEY,
      context.getHandler(),
    );
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const email = (request.body as { email?: unknown } | undefined)?.email;

    // Guard chạy trước ValidationPipe: email sai kiểu thì để pipe báo lỗi
    if (!options || typeof email !== 'string') {
      return true;
    }

    const key = createHash('sha256')
      .update(
        [
          context.getClass().name,
          context.getHandler().name,
          request.ip,
          email.trim().toLowerCase(),
        ].join(':'),
      )
      .digest('hex');
    const { isBlocked, timeToBlockExpire } = await this.storage.increment(
      key,
      options.ttl,
      options.limit,
      options.ttl,
      THROTTLER_NAME,
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
