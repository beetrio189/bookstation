import { createFileRoute } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/auth-layout";
import { ResendVerificationForm } from "./-resend-verification-form";

export const Route = createFileRoute("/resend-verification/")({
  head: () => ({ meta: [{ title: "Gửi lại email xác thực | BookStation" }] }),
  component: () => (
    <AuthLayout>
      <ResendVerificationForm />
    </AuthLayout>
  ),
});
