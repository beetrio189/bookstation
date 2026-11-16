import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

// Màn kết quả chung theo Figma "... (màn hình result)": tiêu đề giữa, mô tả, một nút
export function AuthResult({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex w-full max-w-100 flex-col gap-5 leading-tight">
      <div>
        <h1 className="text-center text-[30px] font-bold">{title}</h1>
        {children && <p className="text-base/5 font-medium">{children}</p>}
      </div>

      {action && (
        <Button asChild className="h-12.5 rounded-lg text-xl font-bold">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}
