import { Plus, Search, Star } from "lucide-react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pagination } from "@/components/admin/pagination";
import { actionButton } from "@/components/app-dialog";
import { GenrePicker } from "@/components/publisher/genre-picker";
import { WarningBox } from "@/components/publisher/warning-box";
import { api } from "@/lib/api";
import {
  contributorLine,
  coverUrl,
  type PublisherBookItem,
  type PublisherBookPage,
} from "@/lib/books";
import { formatDate, formatNumber, type CurrentSubscription } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { DeleteBookDialog } from "./-delete-book-dialog";

const route = getRouteApi("/publisher/books/");
const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;

// Từ xl là bảng theo Figma; hẹp hơn thì mỗi dòng thành một thẻ
const COLUMNS =
  "xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_110px_110px_190px] xl:gap-x-5";
const SMALL_BUTTON =
  "rounded-[10px] border-2 px-5 py-1.5 text-base font-bold transition-colors";

const formatRating = (value: number) =>
  value.toLocaleString("vi-VN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

// Bìa 40×60 (named transformation t_cover_thumb); chưa có / lỗi ảnh thì ô xám
function CoverThumb({ book }: { book: PublisherBookItem }) {
  const src = coverUrl(book.coverPublicId, "thumb");
  const [failed, setFailed] = useState(false);

  return src && !failed ? (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-15 w-10 shrink-0 rounded-[4px] object-cover"
    />
  ) : (
    <span className="h-15 w-10 shrink-0 rounded-[4px] bg-linear-to-br from-[#e2dccb] to-[#cfc6ad]" />
  );
}

function Rating({ book }: { book: PublisherBookItem }) {
  return book.ratingAvg === undefined || book.ratingCount === 0 ? (
    <span className="text-foreground/45">Chưa có</span>
  ) : (
    <span className="flex items-center gap-1">
      <Star className="size-4 fill-foreground" />
      {formatRating(book.ratingAvg)} ({formatNumber(book.ratingCount)})
    </span>
  );
}

// Theo Figma "NXB / Sách / Danh sách"
export function BooksList() {
  const { page = 1, q = "", genres = "" } = route.useSearch();
  const navigate = route.useNavigate();
  const [input, setInput] = useState(q);
  // Gắn kết quả với bộ lọc đã gọi: đổi trang / lọc thì biết dữ liệu đang hiện đã cũ
  const [result, setResult] = useState<{ key: string; data: PublisherBookPage }>();
  const [usage, setUsage] = useState<{ books: number; bookLimit: number }>();
  const [deleting, setDeleting] = useState<PublisherBookItem | null>(null);
  const key = `${page}|${q}|${genres}`;

  const load = useCallback(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      ...(q && { q }),
      ...(genres && { genres }),
    });

    api<PublisherBookPage>(`/publisher/books?${params}`, { auth: true })
      .then((data) => setResult({ key: `${page}|${q}|${genres}`, data }))
      .catch(() => undefined);
  }, [page, q, genres]);

  const loadUsage = useCallback(() => {
    api<CurrentSubscription>("/publisher/subscription", {
      auth: true,
      silent: true,
    })
      .then(({ current, usage: used }) =>
        setUsage({ books: used.books, bookLimit: current.bookLimit }),
      )
      .catch(() => undefined);
  }, []);

  useEffect(load, [load]);
  useEffect(loadUsage, [loadUsage]);

  // Gõ xong 300ms mới tìm, tìm lại từ trang 1
  useEffect(() => {
    const keyword = input.trim();

    if (keyword === q) {
      return;
    }

    const timer = setTimeout(() => {
      void navigate({
        search: (prev) => ({ ...prev, q: keyword || undefined, page: undefined }),
        replace: true,
      });
    }, SEARCH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [input, q, navigate]);

  const data = result?.data;

  // Trang trên URL vượt quá số trang (vừa xóa bớt, sửa tay URL): về trang cuối
  useEffect(() => {
    if (data && data.total > 0 && page > data.totalPages) {
      void navigate({
        search: (prev) => ({ ...prev, page: data.totalPages }),
        replace: true,
      });
    }
  }, [data, page, navigate]);

  const goToPage = (next: number) => {
    void navigate({
      search: (prev) => ({ ...prev, page: next > 1 ? next : undefined }),
    });
  };

  const handleGone = () => {
    toast.error("Sách này không còn tồn tại");
    load();
    loadUsage();
  };

  const isStale = result?.key !== key;
  const isFull = usage !== undefined && usage.books >= usage.bookLimit;
  const isFiltered = q !== "" || genres !== "";

  return (
    <>
      <h1 className="mt-5 text-[28px] font-bold sm:mt-7 sm:text-[32px]">
        Sách
      </h1>

      <div className="mt-5 flex flex-col gap-4 sm:mt-7 xl:flex-row xl:items-center xl:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:gap-6">
          <label className="flex h-14 w-full min-w-0 items-center gap-3 rounded-[20px] border-2 border-foreground bg-white/60 px-5 focus-within:border-primary sm:max-w-110 sm:flex-1">
            <Search className="size-5.5 shrink-0" />
            <input
              type="search"
              value={input}
              maxLength={100}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Tìm theo tên sách, tác giả..."
              aria-label="Tìm theo tên sách, tác giả"
              className="w-full bg-transparent text-lg font-medium outline-none placeholder:text-foreground/50"
            />
          </label>
          <GenrePicker
            variant="filter"
            value={genres ? genres.split(",") : []}
            onChange={(ids) =>
              void navigate({
                search: (prev) => ({
                  ...prev,
                  genres: ids.length > 0 ? ids.join(",") : undefined,
                  page: undefined,
                }),
                replace: true,
              })
            }
          />
        </div>
        <div className="flex items-center justify-between gap-6 xl:justify-end">
          {usage && (
            <span className="text-base font-medium text-foreground/70">
              Đã dùng {formatNumber(usage.books)} /{" "}
              {formatNumber(usage.bookLimit)} sách
            </span>
          )}
          {isFull ? (
            <span
              aria-disabled
              className={cn(
                actionButton("primary"),
                "inline-flex shrink-0 cursor-not-allowed items-center bg-primary/45 text-white",
              )}
            >
              <Plus strokeWidth={2.5} />
              Thêm sách
            </span>
          ) : (
            <Link
              to="/publisher/books/new"
              className={cn(
                actionButton("primary"),
                "inline-flex shrink-0 items-center bg-primary text-white hover:bg-primary/85",
              )}
            >
              <Plus strokeWidth={2.5} />
              Thêm sách
            </Link>
          )}
        </div>
      </div>

      {isFull && usage && (
        <div className="mt-6">
          <WarningBox>
            Đã đạt giới hạn {formatNumber(usage.bookLimit)} sách của gói hiện
            tại. Nâng gói để thêm sách mới.
          </WarningBox>
        </div>
      )}

      <div
        className={cn(
          "mt-6 overflow-hidden rounded-[20px] bg-white transition-opacity sm:mt-8",
          isStale && data && "opacity-60",
        )}
      >
        <div
          className={cn(
            "hidden h-14 items-center bg-foreground/4 px-7 text-base font-bold text-foreground/60 xl:grid",
            COLUMNS,
          )}
        >
          <span>Sách</span>
          <span>Thể loại</span>
          <span>Đánh giá</span>
          <span>Ngày thêm</span>
          <span className="sr-only">Thao tác</span>
        </div>

        {!data && (
          <p className="px-7 py-6 text-lg font-medium text-foreground/50">
            Đang tải...
          </p>
        )}
        {data?.items.length === 0 && (
          <p className="px-7 py-6 text-lg font-medium text-foreground/50">
            {isFiltered
              ? "Không tìm thấy sách nào khớp với từ khóa và thể loại đã chọn."
              : "Chưa có sách nào."}
          </p>
        )}

        {data?.items.map((book) => {
          const genreNames = book.genres.map((genre) => genre.name).join(", ");

          return (
            <div
              key={book.id}
              className={cn(
                "flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-foreground/8 px-5 py-4 xl:grid xl:min-h-19 xl:px-7 xl:py-2",
                COLUMNS,
              )}
            >
              <span className="flex min-w-0 flex-1 basis-full items-center gap-4 sm:basis-0">
                <CoverThumb book={book} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span title={book.title} className="truncate text-lg font-bold">
                    {book.title}
                  </span>
                  <span className="truncate text-[15px] font-medium text-foreground/60">
                    {contributorLine(book.contributors)}
                  </span>
                  {/* Dạng thẻ: thể loại, đánh giá, ngày thêm xếp dưới tên */}
                  <span className="flex flex-wrap items-center gap-x-2 text-[15px] font-medium text-foreground/60 xl:hidden">
                    <span>{genreNames || "Chưa phân loại"}</span>·
                    <Rating book={book} />·
                    <span>{formatDate(book.createdAt)}</span>
                  </span>
                </span>
              </span>
              <span
                title={genreNames}
                className={cn(
                  "hidden truncate text-lg font-medium xl:block",
                  !genreNames && "text-foreground/45",
                )}
              >
                {genreNames || "Chưa phân loại"}
              </span>
              <span className="hidden text-lg font-medium xl:block">
                <Rating book={book} />
              </span>
              <span className="hidden text-lg font-medium xl:block">
                {formatDate(book.createdAt)}
              </span>
              <span className="flex justify-end gap-2.5">
                <Link
                  to="/publisher/books/$bookId/edit"
                  params={{ bookId: book.id }}
                  className={cn(
                    SMALL_BUTTON,
                    "border-foreground hover:bg-foreground/5",
                  )}
                >
                  Sửa
                </Link>
                <button
                  type="button"
                  onClick={() => setDeleting(book)}
                  className={cn(
                    SMALL_BUTTON,
                    "border-[#ff6d6d] text-[#ff6d6d] hover:bg-[#ff6d6d]/8",
                  )}
                >
                  Xóa
                </button>
              </span>
            </div>
          );
        })}
      </div>

      {data && (
        <Pagination
          page={data.page}
          limit={data.limit}
          total={data.total}
          totalPages={data.totalPages}
          unit="sách"
          onChange={goToPage}
        />
      )}

      {deleting && (
        <DeleteBookDialog
          book={deleting}
          onClose={() => setDeleting(null)}
          onDone={() => {
            toast.success(`Đã xóa sách "${deleting.title}"`);
            load();
            loadUsage();
          }}
          onGone={handleGone}
        />
      )}
    </>
  );
}
