import { QueryFailedError } from 'typeorm';

const POSTGRES_UNIQUE_VIOLATION = '23505';

// Vi phạm UNIQUE: hai request cùng lúc tạo trùng dữ liệu, bên đến sau rơi vào đây
export const isUniqueViolation = (error: unknown): boolean =>
  error instanceof QueryFailedError &&
  (error.driverError as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION;
