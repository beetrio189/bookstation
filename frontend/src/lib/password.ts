// Khớp IsNewPassword của backend (backend/src/decorators/is-password.decorator.ts).
// Dùng cho mọi ô "mật khẩu mới": đăng ký, đặt lại mật khẩu, đổi mật khẩu.
// Ô mật khẩu đã có (đăng nhập, mật khẩu hiện tại) không dùng: tài khoản cũ có
// thể đặt mật khẩu trước khi có luật này.
export const NEW_PASSWORD_INPUT_PROPS = {
  minLength: 8,
  maxLength: 72,
  // Trình duyệt tự bọc ^(?:...)$; lookahead đòi đủ chữ thường, chữ hoa, số, ký tự đặc biệt
  pattern: String.raw`(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d])[!-~]+`,
  title:
    "8–72 ký tự, có ít nhất 1 chữ hoa, 1 chữ thường, 1 chữ số và 1 ký tự đặc biệt (ví dụ: ! @ # $ % & * ?), không dấu, không khoảng trắng",
} as const;
