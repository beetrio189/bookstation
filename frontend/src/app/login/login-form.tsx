"use client";

import Image from "next/image";
import Link from "next/link";
import type { FormEvent } from "react";
import { OutlinedInput } from "@/components/outlined-input";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { API_URL } from "@/lib/config";

export function LoginForm() {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // TODO: gọi POST /auth/login khi có lớp gọi API
  };

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

        <Button type="submit" className="h-12.5 rounded-lg text-xl font-bold">
          Đăng nhập
        </Button>
      </form>

      <p className="text-center text-base/5 font-semibold">
        Chưa có tài khoản?{" "}
        <Link href="/register" className="font-bold text-primary-light underline">
          Đăng ký
        </Link>
      </p>
    </div>
  );
}
