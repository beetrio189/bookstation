"use client";

import type { FormEvent } from "react";
import { OutlinedInput } from "@/components/outlined-input";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { usePasswordConfirm } from "@/hooks/use-password-confirm";

// Khớp với RegisterDto của backend
const NAME_MAX_LENGTH = 100;
const PASSWORD_MIN_LENGTH = 8;

export function RegisterForm() {
  const { passwordRef, confirmRef, check } = usePasswordConfirm();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // TODO: gọi POST /auth/register { name, email, password } khi có lớp gọi API
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-100 flex-col gap-5 leading-tight"
    >
      <div>
        <h1 className="text-[30px] font-bold">Đăng ký</h1>
        <p className="text-base/5 font-medium">
          Đăng ký tài khoản để tương tác cùng chúng tôi
        </p>
      </div>

      <OutlinedInput
        id="name"
        name="name"
        label="Tên tài khoản"
        autoComplete="name"
        maxLength={NAME_MAX_LENGTH}
        required
      />
      <OutlinedInput
        id="email"
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        required
      />
      <PasswordInput
        ref={passwordRef}
        id="password"
        name="password"
        label="Mật khẩu"
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        onChange={check}
        required
      />
      <PasswordInput
        ref={confirmRef}
        id="confirm-password"
        label="Nhập lại Mật khẩu"
        autoComplete="new-password"
        onChange={check}
        required
      />

      <Button type="submit" className="h-12.5 rounded-lg text-xl font-bold">
        Đăng ký
      </Button>
    </form>
  );
}
