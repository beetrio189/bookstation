import { ValidationPipe } from '@nestjs/common';
import { validationExceptionFactory } from '../../../../src/utils/errors/validation-exception.factory';
import { ChangePasswordDto } from '../../../../src/modules/auth/dto/change-password.dto';
import { LoginDto } from '../../../../src/modules/auth/dto/login.dto';
import { RegisterDto } from '../../../../src/modules/auth/dto/register.dto';
import { ResetPasswordDto } from '../../../../src/modules/auth/dto/reset-password.dto';
import { VerifyEmailDto } from '../../../../src/modules/auth/dto/verify-email.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  exceptionFactory: validationExceptionFactory,
});
const VALID = {
  email: 'a@example.com',
  password: 'mat-khau-dai',
  name: 'Wing',
};
const validate = (metatype: new () => object, value: object) =>
  pipe.transform(value, { type: 'body', metatype });

describe('auth DTOs', () => {
  it('normalizes the email and trims the display name', async () => {
    await expect(
      validate(RegisterDto, {
        ...VALID,
        email: '  A@Example.COM ',
        name: '  Wing  ',
      }),
    ).resolves.toEqual({
      ...VALID,
      email: 'a@example.com',
      name: 'Wing',
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
      { name: '   ' },
      'Tên hiển thị không được để trống',
    ],
    [
      'a missing display name',
      { name: undefined },
      'Tên hiển thị không hợp lệ',
    ],
    [
      'a too long display name',
      { name: 'a'.repeat(101) },
      'Tên hiển thị quá dài',
    ],
  ])('rejects %s', async (_case, override, message) => {
    await expect(
      validate(RegisterDto, { ...VALID, ...override }),
    ).rejects.toMatchObject({ code: 1000, message });
  });

  it('does not apply the password rules when logging in', async () => {
    await expect(
      validate(LoginDto, { email: ' A@Example.COM ', password: 'ngan' }),
    ).resolves.toEqual({ email: 'a@example.com', password: 'ngan' });
  });

  it.each([
    ['a missing password', {}, 'Vui lòng nhập mật khẩu'],
    ['an empty password', { password: '' }, 'Vui lòng nhập mật khẩu'],
    ['a non-string password', { password: 123 }, 'Mật khẩu không hợp lệ'],
  ])('rejects a login with %s', async (_case, override, message) => {
    await expect(
      validate(LoginDto, { email: VALID.email, ...override }),
    ).rejects.toMatchObject({ code: 1000, message });
  });

  it.each([
    ['a missing token', { token: undefined }, 'Thiếu mã đặt lại mật khẩu'],
    [
      'a short password',
      { newPassword: 'ngan' },
      'Mật khẩu phải có ít nhất 8 ký tự',
    ],
    ['a 75-byte password', { newPassword: 'ệ'.repeat(25) }, 'Mật khẩu quá dài'],
  ])('rejects a password reset with %s', async (_case, override, message) => {
    await expect(
      validate(ResetPasswordDto, {
        token: 'token-1',
        newPassword: 'mat-khau-moi',
        ...override,
      }),
    ).rejects.toMatchObject({ code: 1000, message });
  });

  it.each([
    [
      'a missing current password',
      { currentPassword: undefined },
      'Vui lòng nhập mật khẩu hiện tại',
    ],
    [
      'a short new password',
      { newPassword: 'ngan' },
      'Mật khẩu phải có ít nhất 8 ký tự',
    ],
  ])('rejects a password change with %s', async (_case, override, message) => {
    await expect(
      validate(ChangePasswordDto, {
        currentPassword: 'mat-khau-cu',
        newPassword: 'mat-khau-moi',
        ...override,
      }),
    ).rejects.toMatchObject({ code: 1000, message });
  });

  it('asks for the token when it is missing', async () => {
    await expect(validate(VerifyEmailDto, {})).rejects.toMatchObject({
      message: 'Thiếu mã xác nhận',
    });
  });
});
