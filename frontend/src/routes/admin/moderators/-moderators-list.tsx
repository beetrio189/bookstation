import { ChevronRight, Plus, Search } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PasswordBadge } from "@/components/admin/account-badges";
import { Avatar } from "@/components/avatar";
import { actionButton } from "@/components/app-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import {
  normalizeName,
  ROLE_LABELS,
  type ModeratorListItem,
} from "@/lib/moderators";
import { getRole } from "@/lib/session";
import { cn } from "@/lib/utils";
import { CreateModeratorDialog } from "./-create-moderator-dialog";

// Từ xl là bảng theo Figma; hẹp hơn thì mỗi dòng thành một thẻ.
// Admin: thêm cột Mật khẩu và mũi tên mở chi tiết; KDV chỉ xem
const COLUMNS = {
  admin:
    "xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_220px_180px_40px] xl:gap-x-4",
  moderator: "xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_260px] xl:gap-x-4",
};

export function ModeratorsList() {
  const isAdmin = getRole() === "admin";
  const [items, setItems] = useState<ModeratorListItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const load = useCallback(() => {
    api<{ items: ModeratorListItem[] }>("/admin/moderators", { auth: true })
      .then(({ items }) => setItems(items))
      .catch(() => undefined);
  }, []);

  // Mỗi lần vào trang (kể cả bấm Quay lại từ chi tiết) đều lấy danh sách mới
  useEffect(load, [load]);

  const keyword = normalizeName(query);
  const shown = items?.filter((item) =>
    normalizeName(item.name).includes(keyword),
  );
  const columns = COLUMNS[isAdmin ? "admin" : "moderator"];

  return (
    <>
      <h1 className="mt-5 text-[28px] font-bold sm:mt-7 sm:text-[32px]">Kiểm duyệt viên</h1>

      <div className="mt-5 flex flex-col gap-4 sm:mt-7 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <label className="flex h-14 w-full min-w-0 items-center sm:max-w-110 sm:flex-1 gap-3 rounded-[20px] border-2 border-foreground bg-white/60 px-5 focus-within:border-primary">
          <Search className="size-5.5 shrink-0" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Lọc theo tên..."
            aria-label="Lọc theo tên"
            className="w-full bg-transparent text-lg font-medium outline-none placeholder:text-foreground/50"
          />
        </label>
        {isAdmin && (
          <Button
            className={cn(actionButton("primary"), "shrink-0")}
            onClick={() => setIsCreating(true)}
          >
            <Plus strokeWidth={2.5} />
            Tạo kiểm duyệt viên
          </Button>
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-[20px] bg-white sm:mt-8">
        <div
          className={cn(
            "hidden h-14 items-center bg-foreground/4 px-7 text-base font-bold text-foreground/60",
            "xl:grid",
            columns,
          )}
        >
          <span>Tên</span>
          <span>Email</span>
          <span>Vai trò</span>
          {isAdmin && <span>Mật khẩu</span>}
        </div>

        {shown === undefined && (
          <p className="px-7 py-6 text-lg font-medium text-foreground/50">
            Đang tải...
          </p>
        )}
        {shown?.length === 0 && (
          <p className="px-7 py-6 text-lg font-medium text-foreground/50">
            Không có ai khớp với tên này.
          </p>
        )}

        {shown?.map((item) => {
          const passwordBadge = isAdmin && (
            <PasswordBadge hasPassword={item.hasPassword ?? false} />
          );
          const cells = (
            <>
              <span className="flex min-w-0 flex-1 items-center gap-3.5">
                <Avatar size={44} />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-lg font-bold">
                    {item.name}
                  </span>
                  {/* Dạng thẻ: email, vai trò, mật khẩu xếp dưới tên */}
                  <span className="truncate text-base font-medium text-foreground/75 xl:hidden">
                    {item.email}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-2 xl:hidden">
                    <span className="rounded-full bg-foreground/14 px-3 py-1.5 text-[15px] font-bold">
                      {ROLE_LABELS[item.role]}
                    </span>
                    {passwordBadge}
                  </span>
                </span>
              </span>
              {/* Dạng bảng: các cột còn lại */}
              <span className="hidden truncate text-lg font-medium xl:block">
                {item.email}
              </span>
              <span className="hidden text-[17px] font-semibold xl:block">
                {ROLE_LABELS[item.role]}
              </span>
              {isAdmin && (
                <>
                  <span className="hidden xl:block">{passwordBadge}</span>
                  <ChevronRight className="size-5.5 shrink-0" />
                </>
              )}
            </>
          );
          const rowClass = cn(
            "flex items-center gap-4 border-t border-foreground/8 px-5 py-4 xl:grid xl:h-19 xl:px-7 xl:py-0",
            columns,
          );

          // Chỉ admin xem được chi tiết
          return isAdmin ? (
            <Link
              key={item.id}
              to="/admin/moderators/$id"
              params={{ id: item.id }}
              className={cn(rowClass, "hover:bg-foreground/3")}
            >
              {cells}
            </Link>
          ) : (
            <div key={item.id} className={rowClass}>
              {cells}
            </div>
          );
        })}
      </div>

      {isAdmin && (
        <CreateModeratorDialog
          open={isCreating}
          onOpenChange={setIsCreating}
          onCreated={load}
        />
      )}
    </>
  );
}
