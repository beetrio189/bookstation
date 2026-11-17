import { ArrowLeft, ChevronRight } from "lucide-react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PasswordBadge, StatusCell } from "@/components/admin/account-badges";
import { Avatar } from "@/components/avatar";
import { api, ApiError } from "@/lib/api";
import type { PublisherDetail, PublisherEditorItem } from "@/lib/publishers";
import { cn } from "@/lib/utils";
import { BACK_LINK_CLASS } from "../-publisher-detail";

const route = getRouteApi("/admin/publishers/$id/editors/");
const NOT_FOUND_STATUS = 404;

const COLUMNS =
  "xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_200px_180px_40px] xl:gap-x-4";

// Theo Figma "NXB / Biên tập viên (danh sách)". Trả hết, không phân trang (NXB có ít biên tập viên)
export function EditorsList() {
  const { id } = route.useParams();
  const [publisherName, setPublisherName] = useState<string>();
  const [items, setItems] = useState<PublisherEditorItem[]>();
  const [isNotFound, setIsNotFound] = useState(false);

  useEffect(() => {
    const onError = (error: unknown) => {
      if (error instanceof ApiError && error.status === NOT_FOUND_STATUS) {
        setIsNotFound(true);
      }
    };

    // Tên NXB cho tiêu đề lấy từ API chi tiết
    api<PublisherDetail>(`/admin/publishers/${id}`, { auth: true })
      .then((data) => setPublisherName(data.publisherName))
      .catch(onError);
    api<{ items: PublisherEditorItem[] }>(`/admin/publishers/${id}/editors`, {
      auth: true,
    })
      .then((data) => setItems(data.items))
      .catch(onError);
  }, [id]);

  const back = (
    <Link to="/admin/publishers/$id" params={{ id }} className={BACK_LINK_CLASS}>
      <ArrowLeft className="size-5.5" />
      Quay lại
    </Link>
  );

  if (isNotFound) {
    return (
      <>
        {back}
        <p className="mt-6 rounded-[20px] bg-white px-5 py-6 text-xl font-semibold sm:px-12 sm:py-11">
          Không tìm thấy nhà xuất bản này.
        </p>
      </>
    );
  }

  return (
    <>
      {back}
      <h1 className="mt-6 text-[28px] font-bold break-words sm:text-[32px]">
        Biên tập viên{publisherName && ` của ${publisherName}`}
      </h1>

      <div className="mt-6 overflow-hidden rounded-[20px] bg-white sm:mt-8">
        <div
          className={cn(
            "hidden h-14 items-center bg-foreground/4 px-7 text-base font-bold text-foreground/60 xl:grid",
            COLUMNS,
          )}
        >
          <span>Tên</span>
          <span>Email</span>
          <span>Trạng thái</span>
          <span>Mật khẩu</span>
        </div>

        {!items && (
          <p className="px-7 py-6 text-lg font-medium text-foreground/50">
            Đang tải...
          </p>
        )}
        {items?.length === 0 && (
          <p className="px-7 py-6 text-lg font-medium text-foreground/50">
            Nhà xuất bản này chưa có biên tập viên.
          </p>
        )}

        {items?.map((item) => (
          <Link
            key={item.id}
            to="/admin/publishers/$id/editors/$editorId"
            params={{ id, editorId: item.id }}
            className={cn(
              "flex items-center gap-4 border-t border-foreground/8 px-5 py-4 hover:bg-foreground/3 xl:grid xl:h-19 xl:px-7 xl:py-0",
              COLUMNS,
            )}
          >
            <span className="flex min-w-0 flex-1 items-center gap-3.5">
              <Avatar size={44} />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-lg font-bold">{item.name}</span>
                {/* Dạng thẻ: email, trạng thái, mật khẩu xếp dưới tên */}
                <span className="truncate text-base font-medium text-foreground/75 xl:hidden">
                  {item.email}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-2 xl:hidden">
                  <StatusCell status={item.status} lockedLabel="Đã khóa" />
                  <PasswordBadge hasPassword={item.hasPassword} />
                </span>
              </span>
            </span>
            <span className="hidden truncate text-lg font-medium xl:block">
              {item.email}
            </span>
            <span className="hidden xl:block">
              <StatusCell status={item.status} lockedLabel="Đã khóa" />
            </span>
            <span className="hidden xl:block">
              <PasswordBadge hasPassword={item.hasPassword} />
            </span>
            <ChevronRight className="size-5.5 shrink-0" />
          </Link>
        ))}
      </div>
    </>
  );
}
