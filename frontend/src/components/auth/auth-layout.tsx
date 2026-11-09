import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { AuthArtwork } from "./auth-artwork";

// Khung chung của trang đăng nhập/đăng ký: tranh bên trái, form bên phải
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-28 [--u:calc(100dvh/1080)] wide:bg-cream wide:py-0">
      <AuthArtwork />
      <Logo className="absolute top-4 left-4 wide:top-7.5 wide:left-7.5" />
      {/* Figma: form đặt ở x = 1332 trên khung 1920 */}
      <div className="relative w-full max-w-100 wide:absolute wide:top-1/2 wide:left-[min(calc(var(--u)*1332),calc(100%-432px))] wide:-translate-y-1/2">
        {children}
      </div>
    </main>
  );
}
