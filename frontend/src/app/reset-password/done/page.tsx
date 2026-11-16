import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthResult } from "@/components/auth/auth-result";

export const metadata: Metadata = { title: "Đặt lại mật khẩu thành công" };

// Chưa có frame Figma: màn chỉ có chữ, dùng chung khung AuthResult
export default function ResetPasswordDonePage() {
  return (
    <AuthLayout>
      <AuthResult
        title="Đặt lại mật khẩu thành công!"
        action={{ href: "/login", label: "Đăng nhập" }}
      >
        Mật khẩu của bạn đã được thay đổi và mọi thiết bị đang đăng nhập đã bị
        đăng xuất. Hãy đăng nhập lại bằng mật khẩu mới.
      </AuthResult>
    </AuthLayout>
  );
}
