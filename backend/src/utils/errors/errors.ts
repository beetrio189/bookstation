import { HttpStatus } from '@nestjs/common';

export interface ErrorDefinition {
  code: number;
  status: HttpStatus;
  message: string;
}

/**
 * 1xxx: lỗi chung, 2xxx: tài khoản, 3xxx: quản trị, 4xxx: mua gói / thanh toán, 5xxx: sách. Module mới dùng dải tiếp theo.
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
  // PATCH không có trường nào để sửa (chỉ có note hoặc body rỗng)
  NOTHING_TO_UPDATE: {
    code: 1007,
    status: HttpStatus.BAD_REQUEST,
    message: 'Chưa sửa trường nào',
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
  // Trùng cặp (tên gói, thời hạn)
  PLAN_ALREADY_EXISTS: {
    code: 3004,
    status: HttpStatus.CONFLICT,
    message: 'Gói này với thời hạn này đã tồn tại',
  },
  // Gói Free (duration 'infinity') luôn miễn phí và không xóa được
  FREE_PLAN_PRICE_LOCKED: {
    code: 3006,
    status: HttpStatus.CONFLICT,
    message: 'Gói Free không được trên 0 đồng',
  },
  FREE_PLAN_NOT_DELETABLE: {
    code: 3007,
    status: HttpStatus.CONFLICT,
    message: 'Không được xóa gói Free',
  },
  // Trùng tên (không phân biệt hoa thường, dấu) hoặc trùng slug
  GENRE_ALREADY_EXISTS: {
    code: 3008,
    status: HttpStatus.CONFLICT,
    message: 'Thể loại đã tồn tại',
  },
  // Số biên tập viên đã bằng editor_limit của gói hiện tại (kể cả vừa hạ gói)
  EDITOR_LIMIT_REACHED: {
    code: 3009,
    status: HttpStatus.CONFLICT,
    message:
      'Đã đạt số biên tập viên tối đa của gói hiện tại, hãy nâng gói để thêm biên tập viên',
  },
  // Sửa gói trả phí với giá dưới MIN_PAYMENT_AMOUNT (SePay không nhận)
  PLAN_PRICE_TOO_LOW: {
    code: 3010,
    status: HttpStatus.BAD_REQUEST,
    message: 'Giá tối thiểu là 1.000 đ',
  },

  PLAN_NOT_PURCHASABLE: {
    code: 4000,
    status: HttpStatus.CONFLICT,
    message: 'Gói này không mua được',
  },
  PLAN_LIMIT_EXCEEDED: {
    code: 4001,
    status: HttpStatus.CONFLICT,
    message:
      'Số sách hoặc biên tập viên hiện có vượt giới hạn của gói này, hãy giảm bớt trước khi mua',
  },
  PENDING_PAYMENT_EXISTS: {
    code: 4003,
    status: HttpStatus.CONFLICT,
    message:
      'Bạn đang có một đơn chờ thanh toán, hãy tiếp tục thanh toán hoặc hủy đơn đó trước khi mua gói khác',
  },
  // Tiếp tục thanh toán đơn đã success / failed
  PAYMENT_NOT_PENDING: {
    code: 4004,
    status: HttpStatus.CONFLICT,
    message: 'Đơn này không còn chờ thanh toán',
  },
  // Tiếp tục thanh toán đơn pending đã quá 15 phút (job sẽ hủy)
  PAYMENT_EXPIRED: {
    code: 4005,
    status: HttpStatus.CONFLICT,
    message: 'Đơn này đã hết hạn thanh toán, hãy hủy đơn rồi mua lại',
  },
  // Hủy đơn đã thanh toán (IPN về trước, hoặc SePay báo đã nhận tiền lúc hủy)
  PAYMENT_ALREADY_PAID: {
    code: 4006,
    status: HttpStatus.CONFLICT,
    message: 'Bạn đã thanh toán gói này rồi!',
  },

  // 5xxx: sách. Số sách đã bằng book_limit của gói hiện tại (kể cả vừa hạ gói)
  BOOK_LIMIT_REACHED: {
    code: 5000,
    status: HttpStatus.CONFLICT,
    message:
      'Đã đạt giới hạn số sách của gói hiện tại, hãy nâng gói để thêm sách',
  },
  GENRE_NOT_FOUND: {
    code: 5001,
    status: HttpStatus.BAD_REQUEST,
    message: 'Có thể loại không tồn tại, hãy tải lại danh sách thể loại',
  },
  // public_id không do BE cấp cho NXB này, đã dùng hoặc đã quá 1 giờ
  INVALID_COVER: {
    code: 5002,
    status: HttpStatus.BAD_REQUEST,
    message: 'Ảnh bìa không hợp lệ hoặc đã hết hạn, hãy tải ảnh lên lại',
  },
  // Hai request cùng lúc sinh trùng slug (DB báo unique)
  BOOK_SLUG_CONFLICT: {
    code: 5003,
    status: HttpStatus.CONFLICT,
    message: 'Đường dẫn sách vừa bị trùng, hãy thử lưu lại',
  },
} as const satisfies Record<string, ErrorDefinition>;
