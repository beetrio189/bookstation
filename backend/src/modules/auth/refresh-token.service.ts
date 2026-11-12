import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { LessThanOrEqual, Repository } from 'typeorm';
import { RefreshToken } from './entities/refresh-token.entity';

export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepository: Repository<RefreshToken>,
  ) {}

  async create(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');

    await this.refreshTokensRepository.insert({
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    });

    return token;
  }

  async consume(token: string): Promise<string | null> {
    const { raw } = await this.refreshTokensRepository
      .createQueryBuilder()
      .delete()
      .where('token_hash = :tokenHash AND expires_at > now()', {
        tokenHash: hashToken(token),
      })
      .returning('user_id')
      .execute();

    return (raw as { user_id: string }[])[0]?.user_id ?? null;
  }

  async deleteExpired(now = new Date()): Promise<number> {
    const { affected } = await this.refreshTokensRepository.delete({
      expiresAt: LessThanOrEqual(now),
    });

    return affected ?? 0;
  }

  async revokeAll(userId: string): Promise<void> {
    await this.refreshTokensRepository.delete({ userId });
  }
}
