import { compare, hash } from 'bcryptjs';

const COST_FACTOR = 12;
export const MAX_PASSWORD_BYTES = 72;

export const isPasswordWithinLimit = (password: string): boolean =>
  Buffer.byteLength(password) <= MAX_PASSWORD_BYTES;

export const hashPassword = (password: string): Promise<string> =>
  hash(password, COST_FACTOR);

export const verifyPassword = (
  passwordHash: string,
  password: string,
): Promise<boolean> => compare(password, passwordHash);
