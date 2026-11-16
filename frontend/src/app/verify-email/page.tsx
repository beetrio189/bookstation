import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { VerifyEmailStatus, VerifyingEmail } from "./verify-email-status";

export const metadata: Metadata = { title: "Xác thực email" };

export default function VerifyEmailPage() {
  return (
    <AuthLayout>
      {/* useSearchParams cần Suspense; trong lúc chờ hiện màn "đang xác thực" */}
      <Suspense fallback={<VerifyingEmail />}>
        <VerifyEmailStatus />
      </Suspense>
    </AuthLayout>
  );
}
