import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { BookCard } from "@/components/reader/book-card";
import { PublisherLogo } from "@/components/reader/publisher-logo";
import { ScrollRow } from "@/components/reader/scroll-row";
import { SurveyCard } from "@/components/reader/survey-card";
import type { BookSummary } from "@/lib/reader";
import {
  MOCK_GENRES,
  MOCK_NEWEST,
  MOCK_PUBLISHERS,
  MOCK_SURVEYS,
  MOCK_TOP_RATED,
} from "@/lib/reader-mock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_reader/")({ component: Home });

// Lề trái/phải chung với header
const GUTTER = "px-4 md:px-10 2xl:px-25";

// Hàng vuốt ngang trên mọi màn, ẩn thanh cuộn; lề nằm trong hàng để thẻ trượt sát mép màn
const SCROLL_ROW = cn(
  "flex snap-x scroll-px-4 overflow-x-auto [scrollbar-width:none] md:scroll-px-10 2xl:scroll-px-25",
  GUTTER,
);

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3.5 md:gap-7.5">
      <div className={cn("flex items-center justify-between gap-4", GUTTER)}>
        <h2 className="text-xl font-bold uppercase md:text-[28px]">{title}</h2>
        {/* Trang "xem tất cả" chưa có */}
        <span className="flex shrink-0 items-center text-sm font-semibold text-primary md:text-lg">
          Xem tất cả
          <ChevronRight className="size-4 md:size-5" />
        </span>
      </div>
      {children}
    </section>
  );
}

function BookRow({ books }: { books: BookSummary[] }) {
  return (
    // Chừa chỗ dưới cho bóng của bìa sách khỏi bị cắt.
    // Nút cuộn nằm giữa ảnh bìa: bìa cao 258px (md) / 321px (xl)
    <ScrollRow
      className={cn(SCROLL_ROW, "gap-3.5 pb-3 md:gap-6 xl:gap-8")}
      arrowClassName="md:top-[129px] xl:top-[160px]"
    >
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </ScrollRow>
  );
}

// Trang chủ độc giả (Figma "Trang chủ (mới)"). Dữ liệu đang là mock trong reader-mock.ts
function Home() {
  return (
    <div className="mx-auto flex w-full max-w-480 flex-col gap-7 pt-1 md:gap-12 md:pt-2">
      {/* Bấm thể loại chưa lọc được: trang thể loại chưa có */}
      <div className={cn(SCROLL_ROW, "items-center gap-2 md:gap-3")}>
        <span className="mr-1 hidden shrink-0 text-lg font-bold md:inline">
          Thể loại:
        </span>
        {MOCK_GENRES.map((genre) => (
          <span
            key={genre.id}
            className="shrink-0 rounded-full border border-[#dcd9d1] bg-white px-3.5 py-1.5 text-sm font-semibold md:px-4.5 md:py-2 md:text-base"
          >
            {genre.name}
          </span>
        ))}
      </div>

      <Section title="Đánh giá cao nhất">
        <BookRow books={MOCK_TOP_RATED} />
      </Section>

      <Section title="Sách mới">
        <BookRow books={MOCK_NEWEST} />
      </Section>

      <Section title="Khảo sát đang mở">
        <div
          className={cn(
            "grid gap-3.5 md:grid-cols-2 md:gap-6 xl:grid-cols-3 xl:gap-10",
            GUTTER,
          )}
        >
          {MOCK_SURVEYS.map((survey) => (
            <SurveyCard key={survey.id} survey={survey} />
          ))}
        </div>
      </Section>

      <Section title="Nhà xuất bản">
        <ScrollRow
          className={cn(SCROLL_ROW, "gap-5 pb-1 md:gap-15")}
          arrowClassName="md:top-[60px]"
        >
          {MOCK_PUBLISHERS.map((publisher) => (
            <div
              key={publisher.id}
              className="flex w-18 shrink-0 snap-start flex-col items-center gap-2 md:w-30 md:gap-3.5"
            >
              <PublisherLogo
                publisher={publisher}
                className="w-full border-4 border-white"
              />
              <span className="w-full truncate text-center text-xs font-bold md:text-lg">
                {publisher.publisherName}
              </span>
            </div>
          ))}
        </ScrollRow>
      </Section>
    </div>
  );
}
