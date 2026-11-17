import { HttpStatus } from '@nestjs/common';

export interface ErrorDefinition {
  code: number;
  status: HttpStatus;
  message: string;
}

/**
 * 1xxx: lỗi chung, 2xxx: tài khoản, 3xxx: quản trị. Module mới dùng dải tiếp theo.
 *
 * Quy ước với FE: phân loại lỗi theo `status`, không theo dải `code`.
 * - 429, 5xx (và khi không có response): lỗi hệ thống. FE hiện toast góc
 *   phải với `message`, màn không tự xử lý (frontend/src/lib/api.ts).
 * - 4xx còn lại: lỗi nghiệp vụ. Màn tự hiện lỗi theo `code` (dưới form,
 *   đổi trạng thái màn...).
 * Vì vậy khi thêm lỗi mới: lỗi do người dùng/dữ liệu gửi lên thì dùng 4xx
 * (trừ 429), đừng dùng 5xx; 429 chỉ dành cho rate limit.
 */
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
    message: 'Tài khoản đã tồn tại',
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
    message: 'Tài khoản này chưa có mật khẩu.',
  },
  GOOGLE_AUTH_FAILED: {
    code: 2007,
    status: HttpStatus.UNAUTHORIZED,
    message: 'Đăng nhập Google không thành công, vui lòng thử lại',
  },
  SAME_PASSWORD: {
    code: 2008,
    status: HttpStatus.BAD_REQUEST,
    message: 'Mật khẩu mới phải khác với mật khẩu đã sử dụng trước đó',
  },
  PASSWORD_PWNED: {
    code: 2009,
    status: HttpStatus.BAD_REQUEST,
    message:
      'Mật khẩu này đã xuất hiện trong các vụ rò rỉ dữ liệu (theo HaveIBeenPwned), vui lòng chọn mật khẩu khác',
  },
  EMAIL_ALREADY_VERIFIED: {
    code: 2010,
    status: HttpStatus.CONFLICT,
    message:
      'Email này đã được xác minh. Nếu quên mật khẩu, hãy chuyển qua Quên mật khẩu',
  },

  PUBLISHER_ALREADY_SUSPENDED: {
    code: 3000,
    status: HttpStatus.CONFLICT,
    message: 'Nhà xuất bản này đang bị đình chỉ',
  },
  PUBLISHER_NOT_SUSPENDED: {
    code: 3001,
    status: HttpStatus.CONFLICT,
    message: 'Nhà xuất bản này không bị đình chỉ',
  },
  // Tài khoản đích (NXB, biên tập viên) đang bị khóa, khác ACCOUNT_LOCKED là chính người gọi bị khóa
  TARGET_ACCOUNT_LOCKED: {
    code: 3002,
    status: HttpStatus.CONFLICT,
    message: 'Tài khoản này đang bị khóa',
  },
  PASSWORD_RESET_LIMIT: {
    code: 3003,
    status: HttpStatus.TOO_MANY_REQUESTS,
    message:
      'Đã quá số lần đặt lại mật khẩu trong ngày, vui lòng thử lại sau 24 tiếng',
  },
} as const satisfies Record<string, ErrorDefinition>;
