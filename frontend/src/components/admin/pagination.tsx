import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const CELL =
  "flex h-11 min-w-11 items-center justify-center rounded-[10px] px-2 text-[17px] font-bold";

// Các số trang cần hiện: trang đầu, cuối, quanh trang hiện tại; chỗ bỏ qua là "…"
function pageItems(page: number, totalPages: number): (number | "gap")[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
  const items: (number | "gap")[] = [];

  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) {
      items.push("gap");
    }
    items.push(p);
  });

  return items;
}

// Theo Figma "NXB / Danh sách": "Hiển thị 1–20 trong 137 …" và nút trang
export function Pagination({
  page,
  limit,
  total,
  totalPages,
  unit,
  onChange,
}: {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  unit: string;
  onChange: (page: number) => void;
}) {
  if (total === 0) {
    return null;
  }

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[17px] font-medium text-foreground/70">
        Hiển thị {from}–{to} trong {total} {unit}
      </p>
      {totalPages > 1 && (
        <nav aria-label="Phân trang" className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-label="Trang trước"
            disabled={page <= 1}
            onClick={() => onChange(page - 1)}
            className={cn(CELL, "bg-white disabled:opacity-40")}
          >
            <ChevronLeft className="size-5" />
          </button>
          {pageItems(page, totalPages).map((item, i) =>
            item === "gap" ? (
              <span key={`gap-${i}`} className={cn(CELL, "text-foreground/50")}>
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                aria-current={item === page ? "page" : undefined}
                onClick={() => onChange(item)}
                className={cn(
                  CELL,
                  item === page
                    ? "bg-primary text-white"
                    : "bg-white hover:bg-foreground/5",
                )}
              >
                {item}
              </button>
            ),
          )}
          <button
            type="button"
            aria-label="Trang sau"
            disabled={page >= totalPages}
            onClick={() => onChange(page + 1)}
            className={cn(CELL, "bg-white disabled:opacity-40")}
          >
            <ChevronRight className="size-5" />
          </button>
        </nav>
      )}
    </div>
  );
}
