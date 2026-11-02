import { ValidationError } from 'class-validator';
import { AppException } from './app.exception';
import { ERRORS } from './errors';

const findFirstMessage = (errors: ValidationError[]): string | undefined => {
  for (const error of errors) {
    const message =
      Object.values(error.constraints ?? {})[0] ??
      findFirstMessage(error.children ?? []);

    if (message) {
      return message;
    }
  }

  return undefined;
};

// error chỉ có code và message, nên mỗi lần chỉ báo lỗi của trường sai đầu tiên.
// Mỗi validator trong DTO phải tự khai báo message tiếng Việt.
export const validationExceptionFactory = (errors: ValidationError[]) =>
  new AppException(ERRORS.VALIDATION_ERROR, findFirstMessage(errors));
