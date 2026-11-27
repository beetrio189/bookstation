import { Plus, Search } from "lucide-react";
import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { NoteConfirmDialog } from "@/components/admin/note-confirm-dialog";
import { Pagination } from "@/components/admin/pagination";
import { actionButton } from "@/components/app-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { AdminGenreItem, AdminGenrePage } from "@/lib/genres";
import { formatDate, formatNumber } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { GenreFormDialog } from "./-genre-form-dialog";

const route = getRouteApi("/admin/genres/");
const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;

// Từ xl là bảng theo Figma; hẹp hơn thì mỗi dòng thành một thẻ
const COLUMNS =
  "xl:grid-cols-[minmax(0,1fr)_200px_200px_190px] xl:gap-x-4";
const SMALL_BUTTON =
  "rounded-[10px] border-2 px-5 py-1.5 text-base font-bold transition-colors";

// Theo Figma "Thể loại / Danh sách"
export function GenresList() {
  const { page = 1, q = "" } = route.useSearch();
  const navigate = route.useNavigate();
  const [input, setInput] = useState(q);
  // Gắn kết quả với trang + từ khóa đã gọi: đổi trang thì biết dữ liệu đang hiện đã cũ
  const [result, setResult] = useState<{ key: string; data: AdminGenrePage }>();
  // undefined: đóng; null: thêm; AdminGenreItem: sửa thể loại đó
  const [editing, setEditing] = useState<AdminGenreItem | null | undefined>();
  const [deleting, setDeleting] = useState<AdminGenreItem | null>(null);
  const key = `${page}|${q}`;

  const load = useCallback(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      ...(q && { q }),
    });

    api<AdminGenrePage>(`/admin/genres?${params}`, { auth: true })
      .then((data) => setResult({ key: `${page}|${q}`, data }))
      .catch(() => undefined);
  }, [page, q]);

  useEffect(load, [load]);

  // Gõ xong 300ms mới tìm, tìm lại từ trang 1
  useEffect(() => {
    const keyword = input.trim();

    if (keyword === q) {
      return;
    }

    const timer = setTimeout(() => {
      void navigate({
        search: { q: keyword || undefined },
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

  // Thể loại đã bị người khác xóa trong lúc đang sửa / xóa
  const handleGone = () => {
    setEditing(undefined);
    toast.error("Thể loại này không còn tồn tại");
    load();
  };

  const isStale = result?.key !== key;

  return (
    <>
      <h1 className="mt-5 text-[28px] font-bold sm:mt-7 sm:text-[32px]">
        Thể loại
      </h1>

      <div className="mt-5 flex flex-col gap-4 sm:mt-7 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <label className="flex h-14 w-full min-w-0 items-center gap-3 rounded-[20px] border-2 border-foreground bg-white/60 px-5 focus-within:border-primary sm:max-w-110 sm:flex-1">
          <Search className="size-5.5 shrink-0" />
          <input
            type="search"
            value={input}
            maxLength={100}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Tìm theo tên thể loại..."
            aria-label="Tìm theo tên thể loại"
            className="w-full bg-transparent text-lg font-medium outline-none placeholder:text-foreground/50"
          />
        </label>
        <Button
          className={cn(actionButton("primary"), "shrink-0")}
          onClick={() => setEditing(null)}
        >
          <Plus strokeWidth={2.5} />
          Thêm thể loại
        </Button>
      </div>

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
          <span>Tên thể loại</span>
          <span>Số sách</span>
          <span>Ngày tạo</span>
          <span className="sr-only">Thao tác</span>
        </div>

        {!data && (
          <p className="px-7 py-6 text-lg font-medium text-foreground/50">
            Đang tải...
          </p>
        )}
        {data?.items.length === 0 && (
          <p className="px-7 py-6 text-lg font-medium text-foreground/50">
            {q
              ? "Không tìm thấy thể loại nào khớp với từ khóa này."
              : "Chưa có thể loại nào."}
          </p>
        )}

        {data?.items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-foreground/8 px-5 py-4 xl:grid xl:h-19 xl:px-7 xl:py-0",
              COLUMNS,
            )}
          >
            <span className="flex min-w-0 flex-1 basis-full flex-col gap-1 sm:basis-0">
              <span className="truncate text-lg font-bold">{item.name}</span>
              {/* Dạng thẻ: số sách và ngày tạo xếp dưới tên */}
              <span className="text-base font-medium text-foreground/60 xl:hidden">
                {formatNumber(item.bookCount)} sách · Tạo{" "}
                {formatDate(item.createdAt)}
              </span>
            </span>
            <span className="hidden text-lg font-medium xl:block">
              {formatNumber(item.bookCount)}
            </span>
            <span className="hidden text-lg font-medium xl:block">
              {formatDate(item.createdAt)}
            </span>
            <span className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditing(item)}
                className={cn(
                  SMALL_BUTTON,
                  "border-foreground hover:bg-foreground/5",
                )}
              >
                Sửa
              </button>
              <button
                type="button"
                onClick={() => setDeleting(item)}
                className={cn(
                  SMALL_BUTTON,
                  "border-[#ff6d6d] text-[#ff6d6d] hover:bg-[#ff6d6d]/8",
                )}
              >
                Xóa
              </button>
            </span>
          </div>
        ))}
      </div>

      {data && (
        <Pagination
          page={data.page}
          limit={data.limit}
          total={data.total}
          totalPages={data.totalPages}
          unit="thể loại"
          onChange={goToPage}
        />
      )}

      {editing !== undefined && (
        <GenreFormDialog
          genre={editing ?? undefined}
          onClose={() => setEditing(undefined)}
          onSaved={(message) => {
            setEditing(undefined);
            toast.success(message);
            load();
          }}
          onGone={handleGone}
        />
      )}

      {deleting && (
        <NoteConfirmDialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          title={`Xóa thể loại "${deleting.name}"?`}
          description={
            deleting.bookCount > 0
              ? `Thể loại này đang gắn với ${formatNumber(deleting.bookCount)} sách. Các sách sẽ bị gỡ khỏi thể loại này; sách không còn thể loại nào sẽ thành "Chưa phân loại". Không thể khôi phục.`
              : "Thể loại này chưa gắn với sách nào. Không thể khôi phục."
          }
          placeholder="VD: Trùng với thể loại Kinh doanh"
          confirmLabel="Xóa thể loại"
          kind="danger"
          noteOptional
          submit={(note) =>
            api(`/admin/genres/${deleting.id}`, {
              method: "DELETE",
              auth: true,
              silent: true,
              body: { note },
            })
          }
          onDone={() => {
            toast.success(`Đã xóa thể loại "${deleting.name}"`);
            load();
          }}
          onGone={handleGone}
        />
      )}
    </>
  );
}
