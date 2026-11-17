import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Nút tròn ‹ ›: bình thường mờ 35%, rê chuột vào hàng thì lên 70% (không đậm hẳn)
const ARROW_CLASS =
  "absolute top-1/2 z-10 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-foreground opacity-35 shadow-[0_4px_16px_rgba(0,0,0,0.18)] transition-opacity group-hover/row:opacity-70 focus-visible:opacity-70 md:flex";

/**
 * Hàng vuốt ngang có nút ‹ › hai bên; đã ở đầu/cuối hàng thì ẩn nút bên đó.
 * Màn hẹp (dưới md) không có nút, vuốt bằng tay.
 */
export function ScrollRow({
  className,
  arrowClassName,
  children,
}: {
  className?: string;
  // Đặt nút ngang giữa phần hình của thẻ (ảnh bìa, logo), không tính chữ bên dưới
  arrowClassName?: string;
  children: ReactNode;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ atStart: true, atEnd: true });

  useEffect(() => {
    const row = rowRef.current;

    if (!row) {
      return;
    }

    const update = () => {
      // Lệch 1px do làm tròn khi phóng to/thu nhỏ trình duyệt
      setEdges({
        atStart: row.scrollLeft <= 1,
        atEnd: row.scrollLeft + row.clientWidth >= row.scrollWidth - 1,
      });
    };

    // ResizeObserver gọi update ngay lần đầu, rồi mỗi khi hàng đổi kích thước
    const observer = new ResizeObserver(update);
    observer.observe(row);
    row.addEventListener("scroll", update, { passive: true });

    return () => {
      observer.disconnect();
      row.removeEventListener("scroll", update);
    };
  }, []);

  // Mỗi lần bấm cuộn khoảng 80% bề ngang đang thấy
  const scrollBy = (direction: 1 | -1) => {
    const row = rowRef.current;

    row?.scrollBy({ left: direction * row.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className="group/row relative">
      <div ref={rowRef} className={className}>
        {children}
      </div>
      {!edges.atStart && (
        <button
          type="button"
          aria-label="Cuộn sang trái"
          onClick={() => scrollBy(-1)}
          className={cn(ARROW_CLASS, "left-4 2xl:left-10", arrowClassName)}
        >
          <ChevronLeft className="size-6" />
        </button>
      )}
      {!edges.atEnd && (
        <button
          type="button"
          aria-label="Cuộn sang phải"
          onClick={() => scrollBy(1)}
          className={cn(ARROW_CLASS, "right-4 2xl:right-10", arrowClassName)}
        >
          <ChevronRight className="size-6" />
        </button>
      )}
    </div>
  );
}
