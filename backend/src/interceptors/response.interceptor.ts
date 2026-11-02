import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

const omitNulls = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(omitNulls);
  }

  if (value === null || typeof value !== 'object' || value instanceof Date) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, property]) => property !== null && property !== undefined)
      .map(([key, property]) => [key, omitNulls(property)]),
  );
};

// data luôn là object: mảng nằm trong items, không có kết quả thì là {}
const toData = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return {};
  }

  return Array.isArray(value) ? { items: omitNulls(value) } : omitNulls(value);
};

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<{ data: unknown }> {
    return next.handle().pipe(map((value) => ({ data: toData(value) })));
  }
}
