import { ValidationPipe } from '@nestjs/common';
import { validationExceptionFactory } from '../../../utils/errors/validation-exception.factory';
import { RegisterDto } from './register.dto';
import { VerifyEmailDto } from './verify-email.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  exceptionFactory: validationExceptionFactory,
});
const VALID = {
  email: 'a@example.com',
  password: 'mat-khau-dai',
  displayName: 'Wing',
};
const validate = (metatype: new () => object, value: object) =>
  pipe.transform(value, { type: 'body', metatype });

describe('auth DTOs', () => {
  it('normalizes the email and trims the display name', async () => {
    await expect(
      validate(RegisterDto, {
        ...VALID,
        email: '  A@Example.COM ',
        displayName: '  Wing  ',
      }),
    ).resolves.toEqual({
      ...VALID,
      email: 'a@example.com',
      displayName: 'Wing',
    });
  });

  it('accepts a password of exactly 72 bytes in Vietnamese', async () => {
    await expect(
      validate(RegisterDto, { ...VALID, password: 'ệ'.repeat(24) }),
    ).resolves.toBeInstanceOf(RegisterDto);
  });

  it.each([
    ['a missing email', { email: undefined }, 'Email không đúng định dạng'],
    ['a bad email', { email: 'abc' }, 'Email không đúng định dạng'],
    [
      'a too long email',
      { email: `${'a'.repeat(250)}@example.com` },
      'Email không đúng định dạng',
    ],
    ['a missing password', { password: undefined }, 'Mật khẩu không hợp lệ'],
    [
      'a short password',
      { password: 'ngan' },
      'Mật khẩu phải có ít nhất 8 ký tự',
    ],
    ['a 73-byte password', { password: 'a'.repeat(73) }, 'Mật khẩu quá dài'],
    ['a 75-byte password', { password: 'ệ'.repeat(25) }, 'Mật khẩu quá dài'],
    [
      'a blank display name',
      { displayName: '   ' },
      'Tên hiển thị không được để trống',
    ],
    [
      'a missing display name',
      { displayName: undefined },
      'Tên hiển thị không hợp lệ',
    ],
    [
      'a too long display name',
      { displayName: 'a'.repeat(101) },
      'Tên hiển thị quá dài',
    ],
  ])('rejects %s', async (_case, override, message) => {
    await expect(
      validate(RegisterDto, { ...VALID, ...override }),
    ).rejects.toMatchObject({ code: 1000, message });
  });

  it('asks for the token when it is missing', async () => {
    await expect(validate(VerifyEmailDto, {})).rejects.toMatchObject({
      message: 'Thiếu mã xác nhận',
    });
  });
});
