import { compare, hash } from 'bcryptjs';
import { randomInt } from 'crypto';

const COST_FACTOR = 12;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
// Chữ cái không dấu, chữ số và 32 ký tự đặc biệt !"#$%&'()*+,-./:;<=>?@[\]^_`{|}~,
export const PASSWORD_PATTERN = /^[\x21-\x7E]+$/;
// Mật khẩu mới: đủ chữ thường, chữ hoa, chữ số và ký tự đặc biệt (dùng cùng PASSWORD_PATTERN)
export const PASSWORD_STRENGTH_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d])/;

export const DUMMY_PASSWORD_HASH =
  '$2b$12$giA.HBgG8aulZ8TdFg3hRu/.vYwEi6fZQehRtgnclb2VZvKbwruKO';

export const hashPassword = (password: string): Promise<string> =>
  hash(password, COST_FACTOR);

export const verifyPassword = (
  passwordHash: string,
  password: string,
): Promise<boolean> => compare(password, passwordHash);

// Mật khẩu hệ thống tự cấp (tài khoản NXB, kiểm duyệt viên) gửi qua email:
// bỏ ký tự dễ nhìn nhầm (l, I, O, 0, 1) và ký tự đặc biệt gây rối khi chèn HTML/copy
const GENERATED_PASSWORD_LENGTH = 16;
const PASSWORD_CHAR_GROUPS = [
  'abcdefghijkmnopqrstuvwxyz',
  'ABCDEFGHJKLMNPQRSTUVWXYZ',
  '23456789',
  '!@#$%*-_=+?',
];

const pick = (chars: string) => chars[randomInt(chars.length)];

/**
 * Sinh mật khẩu ngẫu nhiên (crypto) luôn thỏa IsNewPassword: có đủ chữ thường,
 * chữ hoa, chữ số, ký tự đặc biệt. Đủ dài và ngẫu nhiên nên không cần kiểm tra HIBP.
 */
export const generatePassword = (): string => {
  const allChars = PASSWORD_CHAR_GROUPS.join('');
  const chars = PASSWORD_CHAR_GROUPS.map(pick);

  while (chars.length < GENERATED_PASSWORD_LENGTH) {
    chars.push(pick(allChars));
  }

  // Xáo Fisher–Yates để 4 ký tự bắt buộc không luôn đứng đầu
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
};
