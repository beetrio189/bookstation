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
  password: 'MatKhau123',
  name: 'Wing',
};
const UID = '019a6e1c-3f2b-7a4c-8d1e-2b3c4d5e6f70';
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

  it.each(['a'.repeat(8), 'Ab1'.repeat(5)])(
    'accepts the password %s',
    async (password) => {
      await expect(
        validate(RegisterDto, { ...VALID, password }),
      ).resolves.toBeInstanceOf(RegisterDto);
    },
  );

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
    [
      'a 16-character password',
      { password: 'a'.repeat(16) },
      'Mật khẩu chỉ được tối đa 15 ký tự',
    ],
    [
      'a password with Vietnamese letters',
      { password: 'matkhauấ1' },
      'Mật khẩu chỉ được gồm chữ cái không dấu và chữ số',
    ],
    [
      'a password with symbols',
      { password: 'mat-khau-1' },
      'Mật khẩu chỉ được gồm chữ cái không dấu và chữ số',
    ],
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
    ['a bad uid', { uid: 'abc' }, 'Mã đặt lại mật khẩu không hợp lệ'],
    [
      'a short password',
      { newPassword: 'ngan' },
      'Mật khẩu phải có ít nhất 8 ký tự',
    ],
    [
      'a 16-character password',
      { newPassword: 'a'.repeat(16) },
      'Mật khẩu chỉ được tối đa 15 ký tự',
    ],
  ])('rejects a password reset with %s', async (_case, override, message) => {
    await expect(
      validate(ResetPasswordDto, {
        uid: UID,
        token: 'token-1',
        newPassword: 'MatKhauMoi1',
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
        newPassword: 'MatKhauMoi1',
        ...override,
      }),
    ).rejects.toMatchObject({ code: 1000, message });
  });

  it('accepts a verify-email link with a uuidv7 uid', async () => {
    await expect(
      validate(VerifyEmailDto, { uid: UID, token: 'token-1' }),
    ).resolves.toEqual({ uid: UID, token: 'token-1' });
  });

  it.each([
    ['a missing token', { uid: UID }, 'Thiếu mã xác nhận'],
    ['a missing uid', { token: 'token-1' }, 'Mã xác nhận không hợp lệ'],
    ['a bad uid', { uid: 'abc', token: 'token-1' }, 'Mã xác nhận không hợp lệ'],
  ])('rejects a verify-email link with %s', async (_case, value, message) => {
    await expect(validate(VerifyEmailDto, value)).rejects.toMatchObject({
      code: 1000,
      message,
    });
  });
});
