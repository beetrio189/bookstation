import { getRounds } from 'bcryptjs';
import {
  DUMMY_PASSWORD_HASH,
  generatePassword,
  hashPassword,
  PASSWORD_PATTERN,
  PASSWORD_STRENGTH_PATTERN,
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

  it('generates 16-character passwords that pass the new-password rules', () => {
    const passwords = Array.from({ length: 500 }, generatePassword);

    for (const password of passwords) {
      expect(password).toHaveLength(16);
      expect(password).toMatch(PASSWORD_PATTERN);
      expect(password).toMatch(PASSWORD_STRENGTH_PATTERN);
      // Không có ký tự dễ nhìn nhầm hoặc gây rối khi chèn vào HTML
      expect(password).not.toMatch(/[lIO01<>&"'\\\s]/);
    }

    expect(new Set(passwords).size).toBe(passwords.length);
  });

  it('keeps the dummy hash at the same cost as real hashes', async () => {
    expect(getRounds(DUMMY_PASSWORD_HASH)).toBe(
      getRounds(await hashPassword('Mật khẩu bí mật')),
    );
  });
});
