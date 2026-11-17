import { createFileRoute } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthResult } from "@/components/auth/auth-result";

export const Route = createFileRoute("/reset-password/done")({
  head: () => ({ meta: [{ title: "Đặt lại mật khẩu thành công | BookStation" }] }),
  component: ResetPasswordDonePage,
});

// Figma "Đặt lại mật khẩu (thành công)"
function ResetPasswordDonePage() {
  return (
    <AuthLayout>
      <AuthResult
        title="Đặt lại mật khẩu thành công!"
        action={{ to: "/login", label: "Đăng nhập" }}
      >
        Mật khẩu của bạn đã được thay đổi và mọi thiết bị đang đăng nhập đã bị
        đăng xuất. Hãy đăng nhập lại bằng mật khẩu mới.
      </AuthResult>
    </AuthLayout>
  );
}
