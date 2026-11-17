import { createFileRoute } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/auth-layout";
import { ForgotPasswordForm } from "./-forgot-password-form";

export const Route = createFileRoute("/forgot-password/")({
  head: () => ({ meta: [{ title: "Quên mật khẩu | BookStation" }] }),
  component: () => (
    <AuthLayout>
      <ForgotPasswordForm />
    </AuthLayout>
  ),
});
