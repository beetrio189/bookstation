import { applyDecorators } from '@nestjs/common';
import {
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateBy,
} from 'class-validator';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
  PASSWORD_STRENGTH_PATTERN,
} from '../utils/password';

// Định dạng chung: độ dài và ký tự cho phép
const IsPasswordFormat = () =>
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

// Mọi ô mật khẩu (register, login, reset-password, change-password): định dạng
// + đủ 4 loại ký tự. Dùng ValidateBy tên riêng, không dùng Matches lần nữa: hai Matches trùng key
// "matches" thì câu sau đè câu trước, mất câu báo ký tự không hợp lệ
export const IsNewPassword = () =>
  applyDecorators(
    IsPasswordFormat(),
    ValidateBy({
      name: 'isStrongPassword',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && PASSWORD_STRENGTH_PATTERN.test(value),
        defaultMessage: () =>
          'Mật khẩu phải có ít nhất 1 chữ hoa, 1 chữ thường, 1 chữ số và 1 ký tự đặc biệt (ví dụ: ! @ # $ % & * ?)',
      },
    }),
  );
