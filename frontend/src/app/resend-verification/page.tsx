import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { ResendVerificationForm } from "./resend-verification-form";

export const metadata: Metadata = { title: "Gửi lại email xác thực" };

export default function ResendVerificationPage() {
  return (
    <AuthLayout>
      <ResendVerificationForm />
    </AuthLayout>
  );
}
