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
  const get = jest.fn((key: string) => Promise.resolve(store.get(key) ?? null));
  // Giả lập CONSUME_SCRIPT: xóa key chỉ khi hash khớp
  const evalScript = jest.fn(
    (_script: string, _keys: number, key: string, hash: string) => {
      if (store.get(key) !== hash) {
        return Promise.resolve(0);
      }

      store.delete(key);
      return Promise.resolve(1);
    },
  );
  const service = new OneTimeTokenService({
    set,
    get,
    eval: evalScript,
  } as unknown as Redis);
  const purpose = OneTimeTokenPurpose.VERIFY_EMAIL;

  beforeEach(() => {
    store.clear();
    jest.clearAllMocks();
  });

  it('keys by user id and stores only a hash of the token, with the TTL', async () => {
    const token = await service.create(purpose, 'user-1', 60);
    const [key, value, mode, ttl] = set.mock.calls[0] as unknown as unknown[];

    expect(key).toBe('one-time-token:verify-email:user-1');
    expect(value).toMatch(/^[0-9a-f]{64}$/);
    expect(value).not.toBe(token);
    expect([mode, ttl]).toEqual(['EX', 60]);
  });

  it('accepts the token once, then rejects it', async () => {
    const token = await service.create(purpose, 'user-1', 60);

    await expect(service.consume(purpose, 'user-1', token)).resolves.toBe(true);
    await expect(service.consume(purpose, 'user-1', token)).resolves.toBe(
      false,
    );
  });

  it('peeks without using the token up', async () => {
    const token = await service.create(purpose, 'user-1', 60);

    await expect(service.peek(purpose, 'user-1', token)).resolves.toBe(true);
    await expect(service.peek(purpose, 'user-1', token)).resolves.toBe(true);
    await expect(service.consume(purpose, 'user-1', token)).resolves.toBe(true);
    await expect(service.peek(purpose, 'user-1', token)).resolves.toBe(false);
  });

  it('keeps the real token when someone sends a wrong one', async () => {
    const token = await service.create(purpose, 'user-1', 60);

    await expect(service.consume(purpose, 'user-1', 'wrong')).resolves.toBe(
      false,
    );
    await expect(service.consume(purpose, 'user-1', token)).resolves.toBe(true);
  });

  it('rejects a token used with another user id', async () => {
    const token = await service.create(purpose, 'user-1', 60);

    await expect(service.consume(purpose, 'user-2', token)).resolves.toBe(
      false,
    );
  });

  it('invalidates the old token when a new one is created', async () => {
    const first = await service.create(purpose, 'user-1', 60);
    const second = await service.create(purpose, 'user-1', 60);

    expect(first).not.toBe(second);
    await expect(service.peek(purpose, 'user-1', first)).resolves.toBe(false);
    await expect(service.peek(purpose, 'user-1', second)).resolves.toBe(true);
  });
});
