import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { AppException } from '../utils/errors/app.exception';
import { ErrorDefinition, ERRORS } from '../utils/errors/errors';

const ERROR_BY_STATUS: Partial<Record<number, ErrorDefinition>> = {
  [HttpStatus.UNAUTHORIZED]: ERRORS.UNAUTHENTICATED,
  [HttpStatus.FORBIDDEN]: ERRORS.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ERRORS.NOT_FOUND,
  [HttpStatus.TOO_MANY_REQUESTS]: ERRORS.TOO_MANY_REQUESTS,
  [HttpStatus.SERVICE_UNAVAILABLE]: ERRORS.SERVICE_UNAVAILABLE,
};

// Lỗi của Nest dùng HttpException, lỗi của body-parser (JSON sai, body quá lớn) chỉ có statusCode
const getStatus = (exception: unknown): number => {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }

  const statusCode = (exception as { statusCode?: unknown } | null)?.statusCode;

  return typeof statusCode === 'number'
    ? statusCode
    : HttpStatus.INTERNAL_SERVER_ERROR;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof AppException) {
      response.status(exception.getStatus()).json({
        error: { code: exception.code, message: exception.message },
      });
      return;
    }

    const status = getStatus(exception);
    const isServerError = status >= HttpStatus.INTERNAL_SERVER_ERROR;
    const definition =
      ERROR_BY_STATUS[status] ??
      (isServerError ? ERRORS.INTERNAL_ERROR : ERRORS.VALIDATION_ERROR);

    if (isServerError) {
      this.logger.error(exception);
    }

    response.status(status).json({
      error: { code: definition.code, message: definition.message },
    });
  }
}
