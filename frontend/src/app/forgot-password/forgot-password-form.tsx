"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormMessage } from "@/components/form-message";
import { OutlinedInput } from "@/components/outlined-input";
import { Button } from "@/components/ui/button";
import { api, ApiError, isSystemError } from "@/lib/api";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const email = String(new FormData(formElement).get("email"));

    setIsPending(true);
    setError(null);

    try {
      // Luôn trả {} dù email có tài khoản hay không (chống dò email)
      await api("/auth/forgot-password", { method: "POST", body: { email } });
      // Next giữ nguyên trang khi chuyển đi, xóa form để quay lại thấy form trống
      formElement.reset();
      router.push("/forgot-password/sent");
    } catch (caught) {
      // Lỗi hệ thống đã có toast, chỉ hiện dòng chữ cho lỗi nghiệp vụ
      if (caught instanceof ApiError && !isSystemError(caught.status)) {
        setError(caught.message);
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-100 flex-col gap-5 leading-tight"
    >
      <div>
        <h1 className="text-[30px] font-bold">Quên mật khẩu</h1>
        <p className="text-base/5 font-medium">
          Nhập email để nhận đường link đặt lại mật khẩu
        </p>
      </div>

      <OutlinedInput
        id="email"
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        required
      />

      {error && <FormMessage tone="error">{error}</FormMessage>}

      <Button
        type="submit"
        disabled={isPending}
        className="h-12.5 rounded-lg text-xl font-bold"
      >
        Gửi email
      </Button>
    </form>
  );
}
