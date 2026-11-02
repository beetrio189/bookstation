import { applyDecorators } from '@nestjs/common';
import { IsByteLength, IsString, MinLength } from 'class-validator';
import { MAX_PASSWORD_BYTES } from '../utils/password';

export const IsPassword = () =>
  applyDecorators(
    IsString({ message: 'Mật khẩu không hợp lệ' }),
    MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' }),
    IsByteLength(0, MAX_PASSWORD_BYTES, { message: 'Mật khẩu quá dài' }),
  );
