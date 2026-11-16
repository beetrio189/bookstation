import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Dòng thông báo lỗi nghiệp vụ / kết quả ngay dưới form (không dùng toast)
export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "text-center text-sm/4.5 font-semibold",
        tone === "error" ? "text-destructive" : "text-green-600",
      )}
    >
      {children}
    </p>
  );
}
