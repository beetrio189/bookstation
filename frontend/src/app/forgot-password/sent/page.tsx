import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthResult } from "@/components/auth/auth-result";

export const metadata: Metadata = { title: "Quên mật khẩu" };

// Figma "Quên mật khẩu (màn hình result)". Mô tả dùng câu đã chốt sau khi vẽ frame.
export default function ForgotPasswordSentPage() {
  return (
    <AuthLayout>
      <AuthResult
        title="Xử lý thành công!"
        action={{ href: "/", label: "Trở về trang chủ" }}
      >
        Nếu email này có tài khoản đăng nhập bằng mật khẩu, chúng tôi đã gửi
        link đặt lại mật khẩu. Vui lòng kiểm tra hộp thư (kể cả thư mục Spam)
        trong vòng 5 phút. Nếu không nhận được, có thể email này chưa đăng ký,
        tài khoản được tạo bằng Google (hãy dùng Đăng nhập bằng Google) hoặc
        server đang quá tải (hãy quay lại sau).
      </AuthResult>
    </AuthLayout>
  );
}
