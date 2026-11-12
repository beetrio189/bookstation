import { createHash } from 'crypto';
import { LessThanOrEqual, Repository } from 'typeorm';
import { RefreshToken } from '../../../src/modules/auth/entities/refresh-token.entity';
import { RefreshTokenService } from '../../../src/modules/auth/refresh-token.service';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

describe('RefreshTokenService', () => {
  const execute = jest.fn();
  const where = jest.fn();
  const builder = {
    delete: () => builder,
    where,
    returning: () => builder,
    execute,
  };
  const repository = {
    insert: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: () => builder,
  };
  const service = new RefreshTokenService(
    repository as unknown as Repository<RefreshToken>,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    where.mockReturnValue(builder);
  });

  it('stores only the hash of a new token, valid for 30 days', async () => {
    const before = Date.now();
    const token = await service.create('user-1');
    const [row] = repository.insert.mock.calls[0] as [RefreshToken];

    expect(row.userId).toBe('user-1');
    expect(row.tokenHash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    expect(row.tokenHash).not.toContain(token);
    expect(row.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + THIRTY_DAYS_MS,
    );
  });

  it('only inserts when creating a token, cleanup is left to the job', async () => {
    await service.create('user-1');

    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('deletes every expired token and returns how many', async () => {
    const now = new Date('2026-11-13T00:00:00+07:00');
    repository.delete.mockResolvedValue({ affected: 3 });

    await expect(service.deleteExpired(now)).resolves.toBe(3);
    expect(repository.delete).toHaveBeenCalledWith({
      expiresAt: LessThanOrEqual(now),
    });
  });

  it('generates a different token each time', async () => {
    await expect(service.create('user-1')).resolves.not.toBe(
      await service.create('user-1'),
    );
  });

  it('consumes by hash and returns the user id', async () => {
    execute.mockResolvedValue({ raw: [{ user_id: 'user-1' }] });

    await expect(service.consume('token')).resolves.toBe('user-1');
    expect(where).toHaveBeenCalledWith(expect.any(String), {
      tokenHash: createHash('sha256').update('token').digest('hex'),
    });
  });

  it('returns null for an unknown, used or expired token', async () => {
    execute.mockResolvedValue({ raw: [] });

    await expect(service.consume('token')).resolves.toBeNull();
  });

  it('revokes every token of the user', async () => {
    await service.revokeAll('user-1');

    expect(repository.delete).toHaveBeenCalledWith({ userId: 'user-1' });
  });
});
