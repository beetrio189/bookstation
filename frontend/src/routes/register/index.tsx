import { createFileRoute } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/auth-layout";
import { RegisterForm } from "./-register-form";

export const Route = createFileRoute("/register/")({
  head: () => ({ meta: [{ title: "Đăng ký | BookStation" }] }),
  component: () => (
    <AuthLayout>
      <RegisterForm />
    </AuthLayout>
  ),
});
