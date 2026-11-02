import { ValidationError } from 'class-validator';
import { ERRORS } from './errors';
import { validationExceptionFactory } from './validation-exception.factory';

describe('validationExceptionFactory', () => {
  const failure = (overrides: Partial<ValidationError>) =>
    Object.assign(new ValidationError(), { property: 'email' }, overrides);

  it('uses the message of the first failed field', () => {
    const exception = validationExceptionFactory([
      failure({ constraints: { isEmail: 'Email không đúng định dạng' } }),
      failure({ constraints: { isNotEmpty: 'Thiếu mật khẩu' } }),
    ]);

    expect(exception.code).toBe(ERRORS.VALIDATION_ERROR.code);
    expect(exception.getStatus()).toBe(ERRORS.VALIDATION_ERROR.status);
    expect(exception.message).toBe('Email không đúng định dạng');
  });

  it('finds the message of a nested field', () => {
    const exception = validationExceptionFactory([
      failure({
        children: [failure({ constraints: { isInt: 'Số trang phải là số' } })],
      }),
    ]);

    expect(exception.message).toBe('Số trang phải là số');
  });

  it('falls back to the default message', () => {
    expect(validationExceptionFactory([]).message).toBe(
      ERRORS.VALIDATION_ERROR.message,
    );
  });
});
