import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { LessThanOrEqual, MoreThan, Repository } from 'typeorm';
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

  async findUserId(token: string): Promise<string | null> {
    const row = await this.refreshTokensRepository.findOne({
      select: { userId: true },
      where: { tokenHash: hashToken(token), expiresAt: MoreThan(new Date()) },
    });

    return row?.userId ?? null;
  }

  async revoke(token: string): Promise<void> {
    await this.refreshTokensRepository.delete({ tokenHash: hashToken(token) });
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
