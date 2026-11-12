import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException, ThrottlerStorage } from '@nestjs/throttler';
import {
  IP_EMAIL_THROTTLE_KEY,
  IpEmailThrottlerGuard,
} from '../../src/guards/ip-email-throttler.guard';

class AuthController {
  resendVerification() {}
}

const OPTIONS = { limit: 2, ttl: 3_600_000 };

describe('IpEmailThrottlerGuard', () => {
  const header = jest.fn();
  const storage = { increment: jest.fn() };
  const reflector = new Reflector();
  const guard = new IpEmailThrottlerGuard(
    reflector,
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
    Reflect.defineMetadata(IP_EMAIL_THROTTLE_KEY, OPTIONS, handler);
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

  it('allows 2 requests per IP + email, then blocks with Retry-After', async () => {
    const context = contextFor('1.1.1.1', { email: 'a@example.com' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ThrottlerException,
    );
    expect(header).toHaveBeenCalledWith('Retry-After', '3600');
  });

  it('counts the same email in any case or spacing together', async () => {
    await guard.canActivate(contextFor('1.1.1.1', { email: 'a@example.com' }));
    await guard.canActivate(
      contextFor('1.1.1.1', { email: ' A@Example.COM ' }),
    );

    await expect(
      guard.canActivate(contextFor('1.1.1.1', { email: 'a@example.com' })),
    ).rejects.toBeInstanceOf(ThrottlerException);
  });

  it('counts another email or another IP separately', async () => {
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

  it('keeps the email out of the Redis key and uses the configured limits', async () => {
    await guard.canActivate(contextFor('1.1.1.1', { email: 'a@example.com' }));

    const [key, ttl, limit, blockDuration] = storage.increment.mock
      .calls[0] as [string, number, number, number];

    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect([ttl, limit, blockDuration]).toEqual([3_600_000, 2, 3_600_000]);
  });

  it('leaves a missing or non-string email to the validation pipe', async () => {
    await expect(
      guard.canActivate(contextFor('1.1.1.1', { email: 123 })),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(contextFor('1.1.1.1', undefined)),
    ).resolves.toBe(true);
    expect(storage.increment).not.toHaveBeenCalled();
  });

  it('does nothing on a route without the decorator', async () => {
    Reflect.deleteMetadata(IP_EMAIL_THROTTLE_KEY, handler);

    await expect(
      guard.canActivate(contextFor('1.1.1.1', { email: 'a@example.com' })),
    ).resolves.toBe(true);
    expect(storage.increment).not.toHaveBeenCalled();
  });
});
