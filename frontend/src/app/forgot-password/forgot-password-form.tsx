"use client";

import type { FormEvent } from "react";
import { OutlinedInput } from "@/components/outlined-input";
import { Button } from "@/components/ui/button";

export function ForgotPasswordForm() {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // TODO: gọi POST /auth/forgot-password { email } khi có lớp gọi API
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

      <Button type="submit" className="h-12.5 rounded-lg text-xl font-bold">
        Gửi email
      </Button>
    </form>
  );
}
