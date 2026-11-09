"use client";

import type { FormEvent } from "react";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { usePasswordConfirm } from "@/hooks/use-password-confirm";

// Khớp với IsPassword của backend
const PASSWORD_MIN_LENGTH = 8;

export function ResetPasswordForm() {
  const { passwordRef, confirmRef, check } = usePasswordConfirm();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // TODO: gọi POST /auth/reset-password { token, newPassword } khi có lớp
    // gọi API. token lấy từ ?token= trong link email.
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-100 flex-col gap-5 leading-tight"
    >
      <div>
        <h1 className="text-[30px] font-bold">Tạo mật khẩu mới</h1>
        <p className="text-base/5 font-medium">
          Mật khẩu mới của bạn phải khác với mật khẩu đã sử dụng trước đó
        </p>
      </div>

      <PasswordInput
        ref={passwordRef}
        id="new-password"
        name="newPassword"
        label="Mật khẩu mới"
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        onChange={check}
        required
      />
      <PasswordInput
        ref={confirmRef}
        id="confirm-password"
        label="Nhập lại mật khẩu"
        autoComplete="new-password"
        onChange={check}
        required
      />

      <Button type="submit" className="h-12.5 rounded-lg text-xl font-bold">
        Lưu
      </Button>
    </form>
  );
}
