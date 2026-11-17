import { useState } from "react";
import type { PublisherSummary } from "@/lib/reader";
import { cn } from "@/lib/utils";

const COLORS = ["#ed5c54", "#338c73", "#5c66d9", "#d98c33", "#8c59a6", "#4099cc"];

// Chữ cái đầu của 2 từ đầu: "Kim Đồng" → "KĐ", "NXB Trẻ" → "NT"
function initialsOf(name: string) {
  const words = name.split(/\s+/).filter(Boolean);

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

// Cùng tên luôn ra cùng màu
function colorOf(name: string) {
  let hash = 0;

  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return COLORS[hash % COLORS.length];
}

// Logo tròn của NXB; chưa có logo hoặc ảnh lỗi thì hiện chữ viết tắt trên nền màu
export function PublisherLogo({
  publisher,
  className,
}: {
  publisher: Pick<PublisherSummary, "publisherName" | "logoUrl">;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = publisher.logoUrl;
  const base = cn("aspect-square shrink-0 rounded-full", className);

  if (src && failedSrc !== src) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setFailedSrc(src)}
        className={cn(base, "bg-white object-cover")}
      />
    );
  }

  return (
    <span
      aria-hidden
      style={{ backgroundColor: colorOf(publisher.publisherName) }}
      className={cn(
        base,
        "flex items-center justify-center font-bold text-white [container-type:inline-size]",
      )}
    >
      <span className="text-[36cqw]">{initialsOf(publisher.publisherName)}</span>
    </span>
  );
}
