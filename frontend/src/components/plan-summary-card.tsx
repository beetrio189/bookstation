import type { ReactNode } from "react";
import { formatNumber, formatPrice, type PublicPlan } from "@/lib/plans";
import { cn } from "@/lib/utils";

/**
 * Thẻ gói theo component Figma "Thẻ gói (công khai)" / "Thẻ gói (NXB)":
 * tên, giá, mô tả ngay dưới giá, đường kẻ, hạn mức; `children` là phần dưới
 * cùng (lý do, nút). `dimmed`: làm mờ phần thông tin (gói không mua được).
 */
export function PlanSummaryCard({
  title,
  plan,
  dimmed = false,
  className,
  children,
}: {
  title: string;
  plan: PublicPlan;
  dimmed?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <article
      className={cn(
        "flex flex-col gap-3.5 rounded-[20px] bg-white px-7 py-6.5",
        className,
      )}
    >
      <div
        className={cn("flex flex-1 flex-col gap-3.5", dimmed && "opacity-45")}
      >
        <h3 className="text-[22px] font-bold break-words">{title}</h3>
        <p className="text-[28px] font-bold text-primary">
          {formatPrice(plan.price)}
        </p>
        {plan.description && (
          <p className="text-base font-medium break-words whitespace-pre-line text-foreground/60">
            {plan.description}
          </p>
        )}
        <hr className="border-foreground/8" />
        <div className="flex flex-col gap-1.5 text-[17px] font-medium">
          <p>Tối đa {formatNumber(plan.bookLimit)} sách</p>
          <p>Tối đa {formatNumber(plan.editorLimit)} biên tập viên</p>
        </div>
      </div>
      {children}
    </article>
  );
}
