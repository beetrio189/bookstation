import { ChevronRight, Plus, Search } from "lucide-react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PasswordBadge, StatusCell } from "@/components/admin/account-badges";
import { Pagination } from "@/components/admin/pagination";
import { actionButton } from "@/components/app-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { PublisherPage } from "@/lib/publishers";
import { cn } from "@/lib/utils";
import { CreatePublisherDialog } from "./-create-publisher-dialog";

const route = getRouteApi("/admin/publishers/");
const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;

// Từ xl là bảng theo Figma; hẹp hơn thì mỗi dòng thành một thẻ
const COLUMNS = "xl:grid-cols-[minmax(0,1fr)_200px_180px_40px] xl:gap-x-4";

// Theo Figma "NXB / Danh sách" và "NXB / Danh sách (không tìm thấy)"
export function PublishersList() {
  const { page = 1, q = "" } = route.useSearch();
  const navigate = route.useNavigate();
  const [input, setInput] = useState(q);
  // Gắn kết quả với trang + từ khóa đã gọi: đổi trang thì biết dữ liệu đang hiện đã cũ
  const [result, setResult] = useState<{ key: string; data: PublisherPage }>();
  const [isCreating, setIsCreating] = useState(false);
  const key = `${page}|${q}`;

  const load = useCallback(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      ...(q && { q }),
    });

    api<PublisherPage>(`/admin/publishers?${params}`, { auth: true })
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

  // Trang trên URL vượt quá số trang (vừa xóa bớt NXB, sửa tay URL): về trang cuối
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

  const isStale = result?.key !== key;

  return (
    <>
      <h1 className="mt-5 text-[28px] font-bold sm:mt-7 sm:text-[32px]">
        Nhà xuất bản
      </h1>

      <div className="mt-5 flex flex-col gap-4 sm:mt-7 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <label className="flex h-14 w-full min-w-0 items-center gap-3 rounded-[20px] border-2 border-foreground bg-white/60 px-5 focus-within:border-primary sm:max-w-110 sm:flex-1">
          <Search className="size-5.5 shrink-0" />
          <input
            type="search"
            value={input}
            maxLength={100}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Tìm theo tên nhà xuất bản..."
            aria-label="Tìm theo tên nhà xuất bản"
            className="w-full bg-transparent text-lg font-medium outline-none placeholder:text-foreground/50"
          />
        </label>
        <Button
          className={cn(actionButton("primary"), "shrink-0")}
          onClick={() => setIsCreating(true)}
        >
          <Plus strokeWidth={2.5} />
          Tạo nhà xuất bản
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
          <span>Tên nhà xuất bản</span>
          <span>Trạng thái</span>
          <span>Mật khẩu</span>
        </div>

        {!data && (
          <p className="px-7 py-6 text-lg font-medium text-foreground/50">
            Đang tải...
          </p>
        )}
        {data?.items.length === 0 && (
          <p className="px-7 py-6 text-lg font-medium text-foreground/50">
            {q
              ? "Không tìm thấy nhà xuất bản nào khớp với từ khóa này."
              : "Chưa có nhà xuất bản nào."}
          </p>
        )}

        {data?.items.map((item) => (
          <Link
            key={item.id}
            to="/admin/publishers/$id"
            params={{ id: item.id }}
            className={cn(
              "flex items-center gap-4 border-t border-foreground/8 px-5 py-4 hover:bg-foreground/3 xl:grid xl:h-19 xl:px-7 xl:py-0",
              COLUMNS,
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="truncate text-lg font-bold">
                {item.publisherName}
              </span>
              {/* Dạng thẻ: trạng thái và mật khẩu xếp dưới tên */}
              <span className="flex flex-wrap items-center gap-2 xl:hidden">
                <StatusCell status={item.status} />
                <PasswordBadge hasPassword={item.hasPassword} />
              </span>
            </span>
            <span className="hidden xl:block">
              <StatusCell status={item.status} />
            </span>
            <span className="hidden xl:block">
              <PasswordBadge hasPassword={item.hasPassword} />
            </span>
            <ChevronRight className="size-5.5 shrink-0" />
          </Link>
        ))}
      </div>

      {data && (
        <Pagination
          page={data.page}
          limit={data.limit}
          total={data.total}
          totalPages={data.totalPages}
          unit="nhà xuất bản"
          onChange={goToPage}
        />
      )}

      <CreatePublisherDialog
        open={isCreating}
        onOpenChange={setIsCreating}
        onCreated={load}
      />
    </>
  );
}
