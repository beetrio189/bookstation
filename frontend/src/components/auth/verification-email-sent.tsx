import type { ReactNode } from "react";
import { AuthResult } from "@/components/auth/auth-result";

// Màn kết quả sau register / resend-verification (BE chỉ trả {}, câu này do FE tự hiện).
// `resendLink` là chữ "gửi lại email": link sang /resend-verification hoặc nút quay lại form.
export function VerificationEmailSent({
  title,
  resendLink,
}: {
  title: string;
  resendLink: ReactNode;
}) {
  return (
    <AuthResult
      title={title}
      action={{ to: "/login", label: "Về trang đăng nhập" }}
    >
      Email xác thực đã được gửi đi. Nếu không thấy thì vào mục {resendLink}{" "}
      hoặc kiểm tra lại có nhập đúng email không. Nếu sau 10 phút vẫn không có
      kết quả thì có thể server đang bị quá tải, liên hệ quản trị viên qua email
      bookstationadmin@gmail.com hoặc thử lại sau.
    </AuthResult>
  );
}
