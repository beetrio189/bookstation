import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  textClassName,
  to = "/",
}: {
  className?: string;
  // Đổi cỡ chữ "BookStation" (header trang chủ nhỏ hơn mặc định)
  textClassName?: string;
  to?: "/" | "/admin" | "/publisher";
}) {
  return (
    <Link
      to={to}
      // Không coi logo là "đang ở trang này" khi đang ở trang con (/admin/...)
      activeOptions={{ exact: true }}
      className={cn("flex items-center gap-2.5 text-foreground", className)}
    >
      <img src="/icons/logo-bookmark.svg" alt="" width={40} height={40} />
      <span
        className={cn("text-[32px] leading-tight font-semibold", textClassName)}
      >
        BookStation
      </span>
    </Link>
  );
}
