import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { GoogleCallback, GoogleSigningIn } from "./google-callback";

export const metadata: Metadata = { title: "Đăng nhập bằng Google" };

export default function GoogleCallbackPage() {
  return (
    <AuthLayout>
      {/* useSearchParams cần Suspense; trong lúc chờ hiện màn "đang đăng nhập" */}
      <Suspense fallback={<GoogleSigningIn />}>
        <GoogleCallback />
      </Suspense>
    </AuthLayout>
  );
}
