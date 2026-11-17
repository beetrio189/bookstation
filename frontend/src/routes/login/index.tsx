import { createFileRoute } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginForm } from "./-login-form";

export const Route = createFileRoute("/login/")({
  head: () => ({ meta: [{ title: "Đăng nhập | BookStation" }] }),
  component: () => (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  ),
});
