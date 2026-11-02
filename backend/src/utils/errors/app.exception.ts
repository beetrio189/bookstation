import { HttpException } from '@nestjs/common';
import { ErrorDefinition } from './errors';

export class AppException extends HttpException {
  readonly code: number;

  constructor(definition: ErrorDefinition, message = definition.message) {
    super({ code: definition.code, message }, definition.status);
    this.code = definition.code;
    this.message = message;
  }
}
