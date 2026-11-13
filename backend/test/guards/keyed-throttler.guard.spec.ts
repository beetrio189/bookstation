import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException, ThrottlerStorage } from '@nestjs/throttler';
import { Request } from 'express';
import { readIpEmail } from '../../src/decorators/throttle-by-ip-email.decorator';
import {
  KEYED_THROTTLE_KEY,
  KeyedThrottlerGuard,
} from '../../src/guards/keyed-throttler.guard';

class AuthController {
  resendVerification() {}
}

const OPTIONS = {
  name: 'ip-email',
  limit: 2,
  ttl: 3_600_000,
  getKey: readIpEmail,
};

describe('KeyedThrottlerGuard', () => {
  const header = jest.fn();
  const storage = { increment: jest.fn() };
  const guard = new KeyedThrottlerGuard(
    new Reflector(),
    storage as unknown as ThrottlerStorage,
  );
  const handler = AuthController.prototype.resendVerification;
  const contextFor = (ip: string, body: unknown) =>
    ({
      getClass: () => AuthController,
      getHandler: () => handler,
      switchToHttp: () => ({
        getRequest: () => ({ ip, body }),
        getResponse: () => ({ header }),
      }),
    }) as unknown as ExecutionContext;

  // Bộ đếm giả trong RAM, chặn khi vượt limit
  const hits = new Map<string, number>();

  beforeEach(() => {
    hits.clear();
    jest.clearAllMocks();
    Reflect.defineMetadata(KEYED_THROTTLE_KEY, OPTIONS, handler);
    storage.increment.mockImplementation((key: string, _ttl, limit: number) => {
      const total = (hits.get(key) ?? 0) + 1;
      hits.set(key, total);
      return Promise.resolve({
        totalHits: total,
        timeToExpire: 3600,
        isBlocked: total > limit,
        timeToBlockExpire: total > limit ? 3600 : 0,
      });
    });
  });

  it('allows up to the limit per key, then blocks with Retry-After', async () => {
    const context = contextFor('1.1.1.1', { email: 'a@example.com' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ThrottlerException,
    );
    expect(header).toHaveBeenCalledWith('Retry-After', '3600');
  });

  it('counts another key separately', async () => {
    const context = contextFor('1.1.1.1', { email: 'a@example.com' });
    await guard.canActivate(context);
    await guard.canActivate(context);

    await expect(
      guard.canActivate(contextFor('1.1.1.1', { email: 'b@example.com' })),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(contextFor('2.2.2.2', { email: 'a@example.com' })),
    ).resolves.toBe(true);
  });

  it('keeps the raw key out of Redis and uses the configured limits', async () => {
    await guard.canActivate(contextFor('1.1.1.1', { email: 'a@example.com' }));

    const [key, ttl, limit, blockDuration, name] = storage.increment.mock
      .calls[0] as [string, number, number, number, string];

    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect([ttl, limit, blockDuration, name]).toEqual([
      3_600_000,
      2,
      3_600_000,
      'ip-email',
    ]);
  });

  it('skips when the key cannot be read', async () => {
    await expect(
      guard.canActivate(contextFor('1.1.1.1', { email: 123 })),
    ).resolves.toBe(true);
    expect(storage.increment).not.toHaveBeenCalled();
  });

  it('does nothing on a route without the decorator', async () => {
    Reflect.deleteMetadata(KEYED_THROTTLE_KEY, handler);

    await expect(
      guard.canActivate(contextFor('1.1.1.1', { email: 'a@example.com' })),
    ).resolves.toBe(true);
    expect(storage.increment).not.toHaveBeenCalled();
  });
});

describe('readIpEmail', () => {
  const request = (ip: string, body: unknown) =>
    ({ ip, body }) as unknown as Request;

  it('normalizes the email so any case or spacing counts together', () => {
    expect(readIpEmail(request('1.1.1.1', { email: ' A@Example.COM ' }))).toBe(
      '1.1.1.1:a@example.com',
    );
  });

  it('leaves a missing or non-string email to the validation pipe', () => {
    expect(readIpEmail(request('1.1.1.1', { email: 123 }))).toBeUndefined();
    expect(readIpEmail(request('1.1.1.1', undefined))).toBeUndefined();
  });
});
