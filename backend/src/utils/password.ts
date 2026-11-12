import { compare, hash } from 'bcryptjs';

const COST_FACTOR = 12;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
// Chữ cái không dấu, chữ số và 32 ký tự đặc biệt !"#$%&'()*+,-./:;<=>?@[\]^_`{|}~,
export const PASSWORD_PATTERN = /^[\x21-\x7E]+$/;

export const DUMMY_PASSWORD_HASH =
  '$2b$12$giA.HBgG8aulZ8TdFg3hRu/.vYwEi6fZQehRtgnclb2VZvKbwruKO';

export const hashPassword = (password: string): Promise<string> =>
  hash(password, COST_FACTOR);

export const verifyPassword = (
  passwordHash: string,
  password: string,
): Promise<boolean> => compare(password, passwordHash);
