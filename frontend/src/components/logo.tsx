import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("flex items-center gap-2.5 text-foreground", className)}
    >
      <Image src="/icons/logo-bookmark.svg" alt="" width={40} height={40} />
      <span className="text-[32px] leading-tight font-semibold">
        BookStation
      </span>
    </Link>
  );
}
