import Redis from 'ioredis';
import {
  OneTimeTokenPurpose,
  OneTimeTokenService,
} from '../../../src/modules/auth/one-time-token.service';

describe('OneTimeTokenService', () => {
  const store = new Map<string, string>();
  const set = jest.fn((key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve('OK');
  });
  const getdel = jest.fn((key: string) => {
    const value = store.get(key) ?? null;
    store.delete(key);
    return Promise.resolve(value);
  });
  const service = new OneTimeTokenService({ set, getdel } as unknown as Redis);
  const purpose = OneTimeTokenPurpose.VERIFY_EMAIL;

  beforeEach(() => {
    store.clear();
    jest.clearAllMocks();
  });

  it('stores only a hash of the token, with the TTL', async () => {
    const token = await service.create(purpose, 'user-1', 60);
    const [key, value, mode, ttl] = set.mock.calls[0] as unknown as unknown[];

    expect(key).not.toContain(token);
    expect(value).toBe('user-1');
    expect([mode, ttl]).toEqual(['EX', 60]);
  });

  it('returns the user id once, then null', async () => {
    const token = await service.create(purpose, 'user-1', 60);

    await expect(service.consume(purpose, token)).resolves.toBe('user-1');
    await expect(service.consume(purpose, token)).resolves.toBeNull();
  });

  it('rejects an unknown token', async () => {
    await expect(service.consume(purpose, 'unknown')).resolves.toBeNull();
  });

  it('generates a different token each time', async () => {
    const first = await service.create(purpose, 'user-1', 60);
    const second = await service.create(purpose, 'user-1', 60);

    expect(first).not.toBe(second);
  });
});
