import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

export enum OneTimeTokenPurpose {
  VERIFY_EMAIL = 'verify-email',
  RESET_PASSWORD = 'reset-password',
}

const CONSUME_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

// Mỗi user chỉ có một token cho mỗi mục đích: tạo token mới là ghi đè token cũ
const buildKey = (purpose: OneTimeTokenPurpose, userId: string) =>
  `one-time-token:${purpose}:${userId}`;

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class OneTimeTokenService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async create(
    purpose: OneTimeTokenPurpose,
    userId: string,
    ttlSeconds: number,
  ): Promise<string> {
    const token = randomBytes(32).toString('base64url');

    await this.redis.set(
      buildKey(purpose, userId),
      hashToken(token),
      'EX',
      ttlSeconds,
    );

    return token;
  }

  async peek(
    purpose: OneTimeTokenPurpose,
    userId: string,
    token: string,
  ): Promise<boolean> {
    return (
      (await this.redis.get(buildKey(purpose, userId))) === hashToken(token)
    );
  }

  async consume(
    purpose: OneTimeTokenPurpose,
    userId: string,
    token: string,
  ): Promise<boolean> {
    const deleted = await this.redis.eval(
      CONSUME_SCRIPT,
      1,
      buildKey(purpose, userId),
      hashToken(token),
    );

    return deleted === 1;
  }
}
