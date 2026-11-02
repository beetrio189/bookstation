import { HttpStatus } from '@nestjs/common';

export interface ErrorDefinition {
  code: number;
  status: HttpStatus;
  message: string;
}

// 1xxx: lỗi chung, 2xxx: tài khoản. Module mới dùng dải tiếp theo.
export const ERRORS = {
  VALIDATION_ERROR: {
    code: 1000,
    status: HttpStatus.BAD_REQUEST,
    message: 'Dữ liệu không hợp lệ',
  },
  UNAUTHENTICATED: {
    code: 1001,
    status: HttpStatus.UNAUTHORIZED,
    message: 'Bạn chưa đăng nhập',
  },
  FORBIDDEN: {
    code: 1002,
    status: HttpStatus.FORBIDDEN,
    message: 'Bạn không có quyền thực hiện thao tác này',
  },
  NOT_FOUND: {
    code: 1003,
    status: HttpStatus.NOT_FOUND,
    message: 'Không tìm thấy dữ liệu',
  },
  TOO_MANY_REQUESTS: {
    code: 1004,
    status: HttpStatus.TOO_MANY_REQUESTS,
    message: 'Bạn thao tác quá nhanh, vui lòng thử lại sau',
  },
  INTERNAL_ERROR: {
    code: 1005,
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Đã có lỗi xảy ra, vui lòng thử lại sau',
  },
  SERVICE_UNAVAILABLE: {
    code: 1006,
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'Hệ thống đang tạm thời gián đoạn, vui lòng thử lại sau',
  },

  EMAIL_ALREADY_EXISTS: {
    code: 2000,
    status: HttpStatus.CONFLICT,
    message: 'Email này đã được sử dụng',
  },
  INVALID_CREDENTIALS: {
    code: 2001,
    status: HttpStatus.UNAUTHORIZED,
    message: 'Email hoặc mật khẩu không đúng',
  },
  EMAIL_NOT_VERIFIED: {
    code: 2002,
    status: HttpStatus.FORBIDDEN,
    message: 'Vui lòng xác nhận email trước khi đăng nhập',
  },
  ACCOUNT_LOCKED: {
    code: 2003,
    status: HttpStatus.FORBIDDEN,
    message: 'Tài khoản của bạn đã bị khóa',
  },
  INVALID_TOKEN: {
    code: 2004,
    status: HttpStatus.BAD_REQUEST,
    message: 'Liên kết không hợp lệ hoặc đã hết hạn',
  },
  WRONG_PASSWORD: {
    code: 2005,
    status: HttpStatus.BAD_REQUEST,
    message: 'Mật khẩu hiện tại không đúng',
  },
  PASSWORD_NOT_SET: {
    code: 2006,
    status: HttpStatus.BAD_REQUEST,
    message:
      'Tài khoản chưa có mật khẩu, vui lòng dùng chức năng quên mật khẩu để tạo',
  },
} as const satisfies Record<string, ErrorDefinition>;
