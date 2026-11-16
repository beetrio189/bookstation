"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiErrorText } from "@/components/auth/api-error-text";
import { FormMessage } from "@/components/form-message";
import { OutlinedInput } from "@/components/outlined-input";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { api, ApiError, isSystemError } from "@/lib/api";
import { setAccessToken } from "@/lib/auth-token";
import { API_URL } from "@/lib/config";

const EMAIL_NOT_VERIFIED = 2002;

type Message =
  { type: "error"; code: number; text: string } | { type: "verification-sent" };

export function LoginForm() {
  const router = useRouter();
  const [message, setMessage] = useState<Message | null>(null);
  const [email, setEmail] = useState("");
  const [isPending, setIsPending] = useState(false);

  // Lỗi hệ thống đã có toast (api.ts), chỉ hiện dòng chữ cho lỗi nghiệp vụ
  const showError = (error: unknown) => {
    if (error instanceof ApiError && !isSystemError(error.status)) {
      setMessage({ type: "error", code: error.code, text: error.message });
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const submittedEmail = String(form.get("email"));

    setIsPending(true);
    setMessage(null);
    setEmail(submittedEmail);

    try {
      const { accessToken } = await api<{ accessToken: string }>(
        "/auth/login",
        {
          method: "POST",
          body: { email: submittedEmail, password: form.get("password") },
        },
      );

      setAccessToken(accessToken);
      router.push("/");
    } catch (error) {
      showError(error);
    } finally {
      setIsPending(false);
    }
  };

  // Gửi lại bằng chính email vừa đăng nhập, không bắt nhập lại
  const resendVerification = async () => {
    setIsPending(true);

    try {
      await api("/auth/resend-verification", {
        method: "POST",
        body: { email },
      });
      setMessage({ type: "verification-sent" });
    } catch (error) {
      showError(error);
    } finally {
      setIsPending(false);
    }
  };

  const resendButton = (label: string) => (
    <button
      type="button"
      onClick={() => void resendVerification()}
      disabled={isPending}
      className="font-bold text-primary underline disabled:opacity-50"
    >
      {label}
    </button>
  );

  return (
    <div className="flex w-full max-w-100 flex-col gap-5 leading-tight">
      <h1 className="text-[30px] font-bold">Đăng nhập</h1>

      <Button
        asChild
        variant="outline"
        className="h-12.5 gap-2.5 rounded-lg border-2 border-foreground bg-background text-base font-bold"
      >
        {/* Chuyển hẳn sang backend, backend redirect tiếp sang Google */}
        <a href={`${API_URL}/auth/google`}>
          <Image src="/icons/google.svg" alt="" width={20} height={20} />
          Đăng nhập bằng Google
        </a>
      </Button>

      <div className="relative flex items-center justify-center opacity-50">
        <Separator className="absolute bg-foreground" />
        <span className="relative bg-background px-1.25 text-sm/4.5 font-semibold">
          Hoặc
        </span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <OutlinedInput
          id="email"
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          required
        />
        <PasswordInput
          id="password"
          name="password"
          label="Mật khẩu"
          autoComplete="current-password"
          required
        />

        <Link
          href="/forgot-password"
          className="self-center text-sm/4.5 font-bold text-primary hover:underline"
        >
          Quên mật khẩu?
        </Link>

        {message?.type === "error" && (
          <FormMessage tone="error">
            <ApiErrorText code={message.code} text={message.text} />
            {message.code === EMAIL_NOT_VERIFIED && (
              <> {resendButton("Gửi lại email xác nhận")}</>
            )}
          </FormMessage>
        )}
        {message?.type === "verification-sent" && (
          <FormMessage tone="success">
            Email xác thực đã được gửi đi. Nếu không thấy thì bấm{" "}
            {resendButton("gửi lại")} lần nữa hoặc kiểm tra lại có nhập đúng
            email không. Nếu sau 10 phút vẫn không có kết quả thì có thể server
            đang bị quá tải, liên hệ quản trị viên qua email
            admin_bookstation@gmail.com hoặc thử lại sau.
          </FormMessage>
        )}

        <Button
          type="submit"
          disabled={isPending}
          className="h-12.5 rounded-lg text-xl font-bold"
        >
          Đăng nhập
        </Button>
      </form>

      <div className="flex flex-col gap-2.5 text-center text-base/5 font-semibold">
        <p>
          Chưa có tài khoản?{" "}
          <Link
            href="/register"
            className="font-bold text-primary-light underline"
          >
            Đăng ký
          </Link>
        </p>
        <p>
          Chưa nhận được email xác nhận?{" "}
          <Link
            href="/resend-verification"
            className="font-bold text-primary-light underline"
          >
            Gửi lại
          </Link>
        </p>
      </div>
    </div>
  );
}
