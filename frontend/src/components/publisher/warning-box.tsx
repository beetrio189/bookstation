import { TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";

// Theo component Figma "Hộp cảnh báo": nền vàng nhạt, viền cam, chữ nâu
export function WarningBox({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-[#f59e0b] bg-[#fef3c7] px-4 py-3.5 text-[15px]/[1.3] font-medium text-[#92400e]">
      <TriangleAlertIcon className="mt-px size-5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
