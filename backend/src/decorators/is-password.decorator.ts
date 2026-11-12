import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
} from '../utils/password';

export const IsPassword = () =>
  applyDecorators(
    IsString({ message: 'Mật khẩu không hợp lệ' }),
    MinLength(PASSWORD_MIN_LENGTH, {
      message: `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`,
    }),
    MaxLength(PASSWORD_MAX_LENGTH, {
      message: `Mật khẩu chỉ được tối đa ${PASSWORD_MAX_LENGTH} ký tự`,
    }),
    Matches(PASSWORD_PATTERN, {
      message:
        'Mật khẩu chỉ được gồm chữ cái không dấu, chữ số và ký tự đặc biệt',
    }),
  );
