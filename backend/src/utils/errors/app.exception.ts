import { HttpException } from '@nestjs/common';
import { ErrorDefinition } from './errors';

export class AppException extends HttpException {
  readonly code: number;
  // Dữ liệu kèm theo lỗi để FE tự xử lý (ví dụ đơn đang chờ khi bị chặn mua gói)
  readonly details?: Record<string, unknown>;

  /** cause: lỗi gốc, chỉ để log / job đọc, không trả về FE */
  constructor(
    definition: ErrorDefinition,
    message = definition.message,
    details?: Record<string, unknown>,
    cause?: unknown,
  ) {
    super({ code: definition.code, message }, definition.status, { cause });
    this.code = definition.code;
    this.message = message;
    this.details = details;
  }
}
