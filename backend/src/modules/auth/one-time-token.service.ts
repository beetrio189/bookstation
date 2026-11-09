import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

export enum OneTimeTokenPurpose {
  VERIFY_EMAIL = 'verify-email',
  RESET_PASSWORD = 'reset-password',
}

const buildKey = (purpose: OneTimeTokenPurpose, token: string) =>
  `one-time-token:${purpose}:${createHash('sha256').update(token).digest('hex')}`;

@Injectable()
export class OneTimeTokenService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async create(
    purpose: OneTimeTokenPurpose,
    userId: string,
    ttlSeconds: number,
  ): Promise<string> {
    const token = randomBytes(32).toString('base64url');

    await this.redis.set(buildKey(purpose, token), userId, 'EX', ttlSeconds);

    return token;
  }

  // Xem token còn hiệu lực không, chưa xóa
  peek(purpose: OneTimeTokenPurpose, token: string): Promise<string | null> {
    return this.redis.get(buildKey(purpose, token));
  }

  consume(purpose: OneTimeTokenPurpose, token: string): Promise<string | null> {
    return this.redis.getdel(buildKey(purpose, token));
  }
}
