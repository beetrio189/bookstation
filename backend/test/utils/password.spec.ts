import { getRounds } from 'bcryptjs';
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  isPasswordWithinLimit,
  verifyPassword,
} from '../../src/utils/password';

describe('password', () => {
  it('hashes with bcrypt at cost 12 and fits users.password_hash', async () => {
    const passwordHash = await hashPassword('Mật khẩu bí mật');

    expect(passwordHash).toMatch(/^\$2b\$12\$/);
    expect(passwordHash).toHaveLength(60);
  });

  it('accepts the right password and rejects a wrong one', async () => {
    const passwordHash = await hashPassword('Mật khẩu bí mật');

    await expect(verifyPassword(passwordHash, 'Mật khẩu bí mật')).resolves.toBe(
      true,
    );
    await expect(verifyPassword(passwordHash, 'mat khau bi mat')).resolves.toBe(
      false,
    );
  });

  it('keeps the dummy hash at the same cost as real hashes', async () => {
    expect(getRounds(DUMMY_PASSWORD_HASH)).toBe(
      getRounds(await hashPassword('Mật khẩu bí mật')),
    );
  });

  it('limits a password by bytes, not characters', () => {
    expect(isPasswordWithinLimit('a'.repeat(72))).toBe(true);
    expect(isPasswordWithinLimit('a'.repeat(73))).toBe(false);
    expect(isPasswordWithinLimit('ệ'.repeat(24))).toBe(true);
    expect(isPasswordWithinLimit('ệ'.repeat(25))).toBe(false);
  });
});
