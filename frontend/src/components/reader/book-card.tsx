import { Star } from "lucide-react";
import { useState } from "react";
import type { BookSummary } from "@/lib/reader";
import { cn } from "@/lib/utils";

// "4.8" theo kiểu Việt Nam là "4,8"
const formatRating = (value: number) =>
  value.toLocaleString("vi-VN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

export function RatingLine({
  ratingAvg,
  ratingCount,
  className,
}: Pick<BookSummary, "ratingAvg" | "ratingCount"> & { className?: string }) {
  if (ratingAvg === undefined || ratingCount === 0) {
    return (
      <p className={cn("font-semibold text-foreground/55", className)}>
        Chưa có đánh giá
      </p>
    );
  }

  return (
    <p className={cn("flex items-center gap-1 font-semibold", className)}>
      <Star className="size-[1em] fill-[#faa819] text-[#faa819]" />
      {formatRating(ratingAvg)} ({ratingCount.toLocaleString("vi-VN")})
    </p>
  );
}

// Ảnh bìa tỉ lệ 2:3 như Figma (200×300); chưa có ảnh hoặc ảnh lỗi thì hiện bìa mặc định
export function BookCover({
  book,
  className,
}: {
  book: Pick<BookSummary, "title" | "coverUrl">;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = book.coverUrl;
  const base = cn(
    "aspect-[2/3] w-full rounded-[10px] shadow-[0_4px_20px_rgba(0,0,0,0.18)]",
    className,
  );

  if (src && failedSrc !== src) {
    return (
      <img
        src={src}
        alt={book.title}
        loading="lazy"
        onError={() => setFailedSrc(src)}
        className={cn(base, "object-cover")}
      />
    );
  }

  return (
    <div
      className={cn(
        base,
        "flex items-center justify-center bg-linear-to-br from-[#e2dccb] to-[#cfc6ad] p-3 text-center text-sm font-bold text-foreground/60",
      )}
    >
      {book.title}
    </div>
  );
}

// Thẻ sách trên trang chủ (Figma "Trang chủ (mới)"): bìa, tên tối đa 2 dòng, tác giả, đánh giá
export function BookCard({ book }: { book: BookSummary }) {
  return (
    <article className="flex w-31 shrink-0 snap-start flex-col gap-2 md:w-44 xl:w-50 xl:gap-5">
      <BookCover book={book} />
      <div className="flex flex-col gap-0.5 xl:gap-1">
        <h3
          title={book.title}
          className="line-clamp-2 text-sm leading-snug font-bold md:text-base xl:text-xl"
        >
          {book.title}
        </h3>
        <p className="truncate text-xs font-medium text-foreground/60 md:text-sm xl:text-lg xl:text-foreground">
          {book.authors.join(", ")}
        </p>
        <RatingLine
          ratingAvg={book.ratingAvg}
          ratingCount={book.ratingCount}
          className="text-xs md:text-sm xl:text-base"
        />
      </div>
    </article>
  );
}
