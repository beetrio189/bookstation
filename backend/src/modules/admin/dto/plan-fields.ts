import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { MIN_PAYMENT_AMOUNT } from '../../subscriptions/payment-quote';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const MAX_INT = 2_000_000_000;

export const PLAN_DURATION_MONTHS = [6, 12, 24];

/**
 * Tên gói (cũng là tên hiển thị): chữ cái không dấu hoa/thường, chữ số, dấu cách.
 * Cắt khoảng trắng hai đầu và gộp nhiều dấu cách liền nhau thành một.
 */
export const IsPlanName = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
    ),
    Matches(/^[a-zA-Z0-9 ]+$/, {
      message: 'Tên gói chỉ gồm chữ cái không dấu, chữ số và dấu cách',
    }),
    MaxLength(50, { message: 'Tên gói quá dài' }),
    IsNotEmpty({ message: 'Tên gói không được để trống' }),
    IsString({ message: 'Tên gói không hợp lệ' }),
  );

export const IsPlanDescription = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim() : value,
    ),
    MaxLength(1000, { message: 'Mô tả quá dài' }),
    IsString({ message: 'Mô tả không hợp lệ' }),
  );

export const IsPlanPrice = () =>
  applyDecorators(
    Max(MAX_INT, { message: 'Giá quá lớn' }),
    // SePay không nhận thanh toán dưới mức này
    Min(MIN_PAYMENT_AMOUNT, {
      message: `Giá tối thiểu là ${MIN_PAYMENT_AMOUNT.toLocaleString('vi-VN')} đ`,
    }),
    IsInt({ message: 'Giá phải là số nguyên' }),
  );

export const IsPlanLimit = (label: string) =>
  applyDecorators(
    Max(MAX_INT, { message: `${label} quá lớn` }),
    Min(0, { message: `${label} không được âm` }),
    IsInt({ message: `${label} phải là số nguyên` }),
  );
