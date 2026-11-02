import {
  ArgumentsHost,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AppException } from '../../src/utils/errors/app.exception';
import { ERRORS } from '../../src/utils/errors/errors';
import { AllExceptionsFilter } from '../../src/filters/all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  const filter = new AllExceptionsFilter();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  it('returns the code, message and status of an AppException', () => {
    filter.catch(new AppException(ERRORS.EMAIL_ALREADY_EXISTS), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      error: { code: 2000, message: 'Email này đã được sử dụng' },
    });
  });

  it('maps a Nest exception to the Vietnamese error of its status', () => {
    filter.catch(new NotFoundException('Cannot GET /nope'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      error: { code: 1003, message: 'Không tìm thấy dữ liệu' },
    });
  });

  it('treats other client errors as validation errors', () => {
    filter.catch(new BadRequestException('Unexpected token'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: { code: 1000, message: 'Dữ liệu không hợp lệ' },
    });
  });

  it('keeps the status of a body-parser error', () => {
    filter.catch(
      Object.assign(new Error('too large'), { statusCode: 413 }),
      host,
    );

    expect(status).toHaveBeenCalledWith(413);
    expect(json).toHaveBeenCalledWith({
      error: { code: 1000, message: 'Dữ liệu không hợp lệ' },
    });
  });

  it('hides the details of an unknown error and logs it', () => {
    const exception = new Error('password=secret');

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: { code: 1005, message: 'Đã có lỗi xảy ra, vui lòng thử lại sau' },
    });
    expect(Logger.prototype.error).toHaveBeenCalledWith(exception);
  });
});
