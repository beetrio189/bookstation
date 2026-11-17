import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/auth-layout";
import { VerificationEmailSent } from "@/components/auth/verification-email-sent";

export const Route = createFileRoute("/register/sent")({
  head: () => ({ meta: [{ title: "Đăng ký thành công | BookStation" }] }),
  component: RegisterSentPage,
});

// Màn kết quả ở URL riêng (Figma "Đăng ký (màn hình result)")
function RegisterSentPage() {
  return (
    <AuthLayout>
      <VerificationEmailSent
        title="Đăng ký thành công!"
        resendLink={
          <Link
            to="/resend-verification"
            className="font-bold text-primary underline"
          >
            gửi lại email
          </Link>
        }
      />
    </AuthLayout>
  );
}
