import { useId, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Ảnh đại diện tròn. Chưa có ảnh hoặc ảnh lỗi thì hiện ảnh mặc định theo
 * component Figma "Avatar mặc định" (bóng người trên nền tròn).
 */
export function Avatar({
  src,
  size,
  className,
}: {
  src?: string;
  size: number;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const clipId = useId();
  const style = { width: size, height: size };

  if (src && failedSrc !== src) {
    return (
      <img
        src={src}
        alt=""
        style={style}
        onError={() => setFailedSrc(src)}
        className={cn("shrink-0 rounded-full object-cover", className)}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 120 120"
      style={style}
      aria-hidden
      className={cn("shrink-0 rounded-full", className)}
    >
      <circle cx="60" cy="60" r="60" fill="#e2dccb" />
      <clipPath id={clipId}>
        <circle cx="60" cy="60" r="60" />
      </clipPath>
      <g clipPath={`url(#${clipId})`} fill="#181821" fillOpacity="0.55">
        <circle cx="60" cy="46" r="21" />
        <path d="M18 120c0-26 19-42 42-42s42 16 42 42z" />
      </g>
    </svg>
  );
}
