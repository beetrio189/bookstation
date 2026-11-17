import { Search } from "lucide-react";
import { useEffect, useState, type FocusEvent } from "react";
import { BookCover, RatingLine } from "@/components/reader/book-card";
import { PublisherLogo } from "@/components/reader/publisher-logo";
import { searchCatalog, type SearchResult } from "@/lib/reader";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 300;

const GROUP_TITLE = "px-4 pt-3 pb-1.5 text-xs font-bold text-foreground/50 uppercase";
const ROW = "flex items-center gap-3 px-4 py-2.5";

// Ô tìm sách + nhà xuất bản ở header; gõ xong 300ms thì tìm, kết quả chia 2 nhóm
export function SearchBox({
  className,
  autoFocus = false,
}: {
  className?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(autoFocus);
  // Gắn kết quả với từ khóa đã tìm: đang gõ dở thì biết kết quả đã cũ
  const [found, setFound] = useState<{ q: string; result: SearchResult } | null>(
    null,
  );
  const keyword = query.trim();

  useEffect(() => {
    if (!keyword) {
      return;
    }

    let isStale = false;
    const timer = setTimeout(() => {
      void searchCatalog(keyword).then((result) => {
        if (!isStale) {
          setFound({ q: keyword, result });
        }
      });
    }, DEBOUNCE_MS);

    return () => {
      isStale = true;
      clearTimeout(timer);
    };
  }, [keyword]);

  // Bấm ra ngoài ô (kể cả ra ngoài danh sách kết quả) thì đóng
  const closeOnBlurOutside = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsOpen(false);
    }
  };

  const result = found?.q === keyword ? found.result : null;
  const isEmpty = result && !result.books.length && !result.publishers.length;

  return (
    <div
      role="search"
      onBlur={closeOnBlurOutside}
      className={cn("relative", className)}
    >
      <label className="flex h-12 items-center gap-3 rounded-full border border-[#dcd9d1] bg-white px-5 focus-within:border-primary">
        <Search className="size-5.5 shrink-0" />
        <input
          type="search"
          value={query}
          autoFocus={autoFocus}
          maxLength={100}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => event.key === "Escape" && setIsOpen(false)}
          placeholder="Tìm sách, nhà xuất bản..."
          aria-label="Tìm sách, nhà xuất bản"
          className="min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:text-foreground/50"
        />
      </label>

      {isOpen && keyword && (
        <div
          // tabIndex để bấm vào vùng kết quả không làm ô mất focus rồi đóng
          tabIndex={-1}
          className="absolute inset-x-0 top-full z-40 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-foreground/10 bg-white py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)] outline-none"
        >
          {!result && (
            <p className="px-4 py-3 text-sm font-medium text-foreground/55">
              Đang tìm...
            </p>
          )}
          {isEmpty && (
            <p className="px-4 py-3 text-sm font-medium text-foreground/55">
              Không tìm thấy sách hoặc nhà xuất bản nào cho “{keyword}”
            </p>
          )}

          {!!result?.books.length && (
            <section>
              <h4 className={GROUP_TITLE}>Sách</h4>
              {result.books.map((book) => (
                <div key={book.id} className={ROW}>
                  <BookCover book={book} className="w-10 rounded-md text-[0px] shadow-sm" />
                  <div className="min-w-0">
                    <p className="truncate font-bold">{book.title}</p>
                    <p className="truncate text-sm font-medium text-foreground/60">
                      {book.authors.join(", ")}
                    </p>
                    <RatingLine
                      ratingAvg={book.ratingAvg}
                      ratingCount={book.ratingCount}
                      className="text-xs"
                    />
                  </div>
                </div>
              ))}
            </section>
          )}

          {!!result?.publishers.length && (
            <section>
              <h4 className={GROUP_TITLE}>Nhà xuất bản</h4>
              {result.publishers.map((publisher) => (
                <div key={publisher.id} className={ROW}>
                  <PublisherLogo publisher={publisher} className="w-10" />
                  <p className="truncate font-bold">{publisher.publisherName}</p>
                </div>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
