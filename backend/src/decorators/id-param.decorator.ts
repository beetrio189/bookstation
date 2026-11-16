import { Param, ParseUUIDPipe } from '@nestjs/common';
import { AppException } from '../utils/errors/app.exception';
import { ERRORS } from '../utils/errors/errors';

// Tham số :id dạng uuid; sai dạng thì coi như không tìm thấy (404), khỏi truy vấn DB
export const IdParam = (name = 'id') =>
  Param(
    name,
    new ParseUUIDPipe({
      exceptionFactory: () => new AppException(ERRORS.NOT_FOUND),
    }),
  );
