import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PlanSummaryCard } from "@/components/plan-summary-card";
import { api } from "@/lib/api";
import { isFreePlan, type PublicPlan } from "@/lib/plans";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_reader/plans/")({
  head: () => ({ meta: [{ title: "Gói hội viên | BookStation" }] }),
  component: PublicPlans,
});

// Khóa của một thanh chọn thời hạn: số tháng, hoặc "free" cho gói vĩnh viễn
type DurationKey = number | "free";

const keyOf = (plan: PublicPlan): DurationKey => plan.durationMonths ?? "free";

const tabLabel = (key: DurationKey) =>
  key === "free" ? "Vĩnh viễn" : `${key} tháng`;

/**
 * Trang gói công khai (Figma "Công khai / Gói hội viên"): thanh chuyển thời hạn,
 * mỗi lúc chỉ hiện gói của một thời hạn, xếp ngang. Các nút lấy theo thời hạn có
 * trong dữ liệu (admin có thể thêm thời hạn mới); Vĩnh viễn (gói Free) đứng đầu.
 */
function PublicPlans() {
  const [items, setItems] = useState<PublicPlan[] | null>(null);
  const [selected, setSelected] = useState<DurationKey | null>(null);

  useEffect(() => {
    api<{ items: PublicPlan[] }>("/plans")
      .then(({ items }) => setItems(items))
      .catch(() => setItems([]));
  }, []);

  const keys = useMemo(() => {
    const months = [
      ...new Set(
        (items ?? []).flatMap((plan) =>
          isFreePlan(plan) ? [] : [plan.durationMonths as number],
        ),
      ),
    ].sort((a, b) => a - b);

    return [
      ...((items ?? []).some(isFreePlan) ? (["free"] as const) : []),
      ...months,
    ] as DurationKey[];
  }, [items]);

  // Mặc định chọn thời hạn trả phí ngắn nhất, không có gói trả phí thì Vĩnh viễn
  const active = selected ?? keys.find((key) => key !== "free") ?? keys[0];
  const plans = (items ?? []).filter((plan) => keyOf(plan) === active);

  return (
    <div className="mx-auto flex w-full max-w-480 flex-col items-center gap-8 px-4 pt-6 md:gap-10 md:px-10 md:pt-10 2xl:px-25">
      <h1 className="text-center text-[28px] font-bold md:text-[32px]">
        Gói hội viên cho nhà xuất bản
      </h1>

      {items === null && (
        <p className="text-lg font-medium text-foreground/50">Đang tải...</p>
      )}

      {keys.length > 0 && (
        <div
          role="tablist"
          aria-label="Thời hạn gói"
          className="flex max-w-full overflow-x-auto rounded-2xl border border-foreground/15 bg-white [scrollbar-width:none]"
        >
          {keys.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={key === active}
              onClick={() => setSelected(key)}
              className={cn(
                "h-15 w-30 shrink-0 rounded-[14px] text-base font-bold md:w-45 md:text-lg",
                key === active
                  ? "border-2 border-primary bg-[#c7e6ff]"
                  : "hover:bg-foreground/5",
              )}
            >
              {tabLabel(key)}
            </button>
          ))}
        </div>
      )}

      <div
        role="tabpanel"
        className="flex w-full flex-wrap justify-center gap-6"
      >
        {plans.map((plan) => (
          <PlanSummaryCard
            key={plan.id}
            title={plan.name}
            plan={plan}
            className="w-full sm:w-88"
          />
        ))}
      </div>
    </div>
  );
}
