import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Tạo mật khẩu mới" };

export default function ResetPasswordPage() {
  return (
    <AuthLayout>
      {/* Form đọc uid/token bằng useSearchParams nên phải nằm trong Suspense */}
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}
