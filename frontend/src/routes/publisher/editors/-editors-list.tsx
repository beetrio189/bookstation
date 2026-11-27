import { ChevronRight, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PasswordBadge } from "@/components/admin/account-badges";
import { Avatar } from "@/components/avatar";
import { actionButton } from "@/components/app-dialog";
import { WarningBox } from "@/components/publisher/warning-box";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { EditorListItem } from "@/lib/editors";
import { formatDate, formatNumber, type CurrentSubscription } from "@/lib/plans";
import { getRole, getUserId } from "@/lib/session";
import { cn } from "@/lib/utils";
import { CreateEditorDialog } from "./-create-editor-dialog";

// Từ xl là bảng theo Figma; hẹp hơn thì mỗi dòng thành một thẻ.
// NXB: thêm cột Mật khẩu và mũi tên mở chi tiết; biên tập viên chỉ xem
const COLUMNS = {
  owner:
    "xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_160px_180px_40px] xl:gap-x-4",
  editor: "xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_160px] xl:gap-x-4",
};

const Badge = ({ children }: { children: string }) => (
  <span className="w-fit shrink-0 rounded-full bg-foreground/14 px-3 py-1 text-sm font-bold">
    {children}
  </span>
);

// Theo Figma "NXB / Biên tập viên / Danh sách" (+ đạt hạn mức, biên tập viên xem)
export function EditorsList() {
  const isOwner = getRole() === "publisher";
  const myId = getUserId();
  const [items, setItems] = useState<EditorListItem[]>();
  const [usage, setUsage] = useState<{ editors: number; editorLimit: number }>();
  const [isCreating, setIsCreating] = useState(false);

  const load = useCallback(() => {
    api<{ items: EditorListItem[] }>("/publisher/editors", { auth: true })
      .then(({ items: loaded }) => setItems(loaded))
      .catch(() => undefined);

    // Mức dùng chỉ NXB xem
    if (isOwner) {
      api<CurrentSubscription>("/publisher/subscription", {
        auth: true,
        silent: true,
      })
        .then(({ current, usage: used }) =>
          setUsage({ editors: used.editors, editorLimit: current.editorLimit }),
        )
        .catch(() => undefined);
    }
  }, [isOwner]);

  // Mỗi lần vào trang (kể cả bấm Quay lại từ chi tiết) đều lấy danh sách mới
  useEffect(load, [load]);

  const isFull = usage !== undefined && usage.editors >= usage.editorLimit;
  const columns = COLUMNS[isOwner ? "owner" : "editor"];

  return (
    <>
      <div className="mt-5 flex flex-col gap-4 sm:mt-7 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <h1 className="text-[28px] font-bold sm:text-[32px]">Biên tập viên</h1>
        {isOwner && (
          <div className="flex items-center justify-between gap-6">
            {usage && (
              <span className="text-base font-medium text-foreground/70">
                Đã dùng {formatNumber(usage.editors)} /{" "}
                {formatNumber(usage.editorLimit)} biên tập viên
              </span>
            )}
            <Button
              className={cn(actionButton("primary"), "shrink-0")}
              disabled={isFull}
              onClick={() => setIsCreating(true)}
            >
              <Plus strokeWidth={2.5} />
              Thêm biên tập viên
            </Button>
          </div>
        )}
      </div>

      {isFull && usage && (
        <div className="mt-6">
          <WarningBox>
            Đã đạt số biên tập viên tối đa ({formatNumber(usage.editorLimit)})
            của gói hiện tại. Nâng gói để thêm biên tập viên.
          </WarningBox>
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-[20px] bg-white sm:mt-8">
        <div
          className={cn(
            "hidden h-14 items-center bg-foreground/4 px-7 text-base font-bold text-foreground/60 xl:grid",
            columns,
          )}
        >
          <span>Tên</span>
          <span>Email</span>
          <span>Ngày thêm</span>
          {isOwner && (
            <>
              <span>Mật khẩu</span>
              <span />
            </>
          )}
        </div>

        {!items && (
          <p className="px-7 py-6 text-lg font-medium text-foreground/50">
            Đang tải...
          </p>
        )}

        {items?.map((item) => {
          const isPublisher = item.role === "publisher";
          const passwordBadge = isOwner && (
            <PasswordBadge hasPassword={item.hasPassword ?? false} />
          );
          const cells = (
            <>
              <span className="flex min-w-0 flex-1 items-center gap-3.5">
                <Avatar size={44} />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="truncate text-lg font-bold">
                      {item.name}
                      {item.id === myId && " (bạn)"}
                    </span>
                    {isPublisher && <Badge>Nhà xuất bản</Badge>}
                  </span>
                  {/* Dạng thẻ: email, ngày thêm, mật khẩu xếp dưới tên */}
                  <span className="truncate text-base font-medium text-foreground/75 xl:hidden">
                    {item.email ?? "—"} · {formatDate(item.createdAt)}
                  </span>
                  {passwordBadge && (
                    <span className="mt-1 xl:hidden">{passwordBadge}</span>
                  )}
                </span>
              </span>
              {/* Dạng bảng: các cột còn lại */}
              <span className="hidden truncate text-lg font-medium xl:block">
                {item.email ?? "—"}
              </span>
              <span className="hidden text-lg font-medium xl:block">
                {formatDate(item.createdAt)}
              </span>
              {isOwner && (
                <>
                  <span className="hidden xl:block">{passwordBadge}</span>
                  {isPublisher ? (
                    <span />
                  ) : (
                    <ChevronRight className="size-5.5 shrink-0" />
                  )}
                </>
              )}
            </>
          );
          const rowClass = cn(
            "flex items-center gap-4 border-t border-foreground/8 px-5 py-4 xl:grid xl:h-19 xl:px-7 xl:py-0",
            columns,
          );

          // Chỉ NXB mở được chi tiết, và chỉ của biên tập viên
          return isOwner && !isPublisher ? (
            <Link
              key={item.id}
              to="/publisher/editors/$editorId"
              params={{ editorId: item.id }}
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

      {isOwner && (
        <CreateEditorDialog
          open={isCreating}
          onOpenChange={setIsCreating}
          onCreated={load}
        />
      )}
    </>
  );
}
