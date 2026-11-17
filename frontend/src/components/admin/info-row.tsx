import type { ReactNode } from "react";

// Một dòng "nhãn — giá trị" trong thẻ chi tiết khu quản trị; màn hẹp nhãn nằm trên giá trị
export function InfoRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row">
      <dt className="shrink-0 font-bold text-foreground/60 sm:w-50">{label}</dt>
      <dd className="min-w-0 font-medium break-words">{children}</dd>
    </div>
  );
}
