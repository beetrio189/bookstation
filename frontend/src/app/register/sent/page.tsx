import type { Metadata } from "next";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/auth-layout";
import { VerificationEmailSent } from "@/components/auth/verification-email-sent";

export const metadata: Metadata = { title: "Đăng ký thành công" };

// Màn kết quả ở URL riêng: Next 16 giữ state của /register khi chuyển trang,
// nên không dùng state để đổi giữa form và màn kết quả
export default function RegisterSentPage() {
  return (
    <AuthLayout>
      <VerificationEmailSent
        title="Đăng ký thành công!"
        resendLink={
          <Link
            href="/resend-verification"
            className="font-bold text-primary underline"
          >
            gửi lại email
          </Link>
        }
      />
    </AuthLayout>
  );
}
