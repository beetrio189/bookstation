import Redis from 'ioredis';
import { PasswordResetQuota } from '../../../src/modules/admin/password-reset-quota';

describe('PasswordResetQuota', () => {
  const redis = { incr: jest.fn(), expire: jest.fn(), decr: jest.fn() };
  const quota = new PasswordResetQuota(redis as unknown as Redis);

  beforeEach(() => jest.clearAllMocks());

  it('starts a 24 hour window on the first reset', async () => {
    redis.incr.mockResolvedValue(1);

    await quota.take('publisher:p-1');

    expect(redis.incr).toHaveBeenCalledWith(
      'admin:password-reset-quota:publisher:p-1',
    );
    expect(redis.expire).toHaveBeenCalledWith(
      'admin:password-reset-quota:publisher:p-1',
      86400,
    );
  });

  it('allows the third reset without restarting the window', async () => {
    redis.incr.mockResolvedValue(3);

    await expect(quota.take('publisher:p-1')).resolves.toBeUndefined();
    expect(redis.expire).not.toHaveBeenCalled();
  });

  it('refuses the fourth reset with 429 3003', async () => {
    redis.incr.mockResolvedValue(4);

    const error = (await quota.take('publisher:p-1').catch((e) => e)) as {
      code: number;
      getStatus: () => number;
    };

    expect(error.code).toBe(3003);
    expect(error.getStatus()).toBe(429);
  });

  it('gives a turn back', async () => {
    await quota.giveBack('editor:e-1');

    expect(redis.decr).toHaveBeenCalledWith(
      'admin:password-reset-quota:editor:e-1',
    );
  });
});
