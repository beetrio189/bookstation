import { ArrowLeft, KeyRound, Trash2 } from "lucide-react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PasswordBadge, StatusCell } from "@/components/admin/account-badges";
import { InfoRow } from "@/components/admin/info-row";
import { NoteConfirmDialog } from "@/components/admin/note-confirm-dialog";
import { Avatar } from "@/components/avatar";
import { actionButton } from "@/components/app-dialog";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/moderators";
import type { EditorDetail as Detail } from "@/lib/publishers";
import { BACK_LINK_CLASS } from "../-publisher-detail";

const route = getRouteApi("/admin/publishers/$id/editors/$editorId");
const NOT_FOUND_STATUS = 404;

type Action = "reset" | "delete";

// Theo Figma "BTV / Chi tiết", "BTV / Xác nhận xóa", "BTV / Xác nhận đặt lại mật khẩu"
export function EditorDetail() {
  const { id, editorId } = route.useParams();
  const navigate = route.useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [action, setAction] = useState<Action | null>(null);

  const load = useCallback(() => {
    api<Detail>(`/admin/editors/${editorId}`, { auth: true })
      .then((data) => {
        setDetail(data);
        setIsNotFound(false);
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === NOT_FOUND_STATUS) {
          setIsNotFound(true);
        }
      });
  }, [editorId]);

  useEffect(load, [load]);

  const toList = () =>
    void navigate({ to: "/admin/publishers/$id/editors", params: { id } });

  const handleGone = () => {
    toast.error("Biên tập viên này không còn tồn tại");
    toList();
  };

  const back = (
    <Link
      to="/admin/publishers/$id/editors"
      params={{ id }}
      className={BACK_LINK_CLASS}
    >
      <ArrowLeft className="size-5.5" />
      Quay lại
    </Link>
  );

  if (isNotFound) {
    return (
      <>
        {back}
        <p className="mt-6 rounded-[20px] bg-white px-5 py-6 text-xl font-semibold sm:px-12 sm:py-11">
          Không tìm thấy biên tập viên này.
        </p>
      </>
    );
  }

  if (!detail) {
    return back;
  }

  // Bị khóa theo NXB (đình chỉ): backend chặn đặt lại mật khẩu (3002)
  const isLocked = detail.status === "locked";
  const dialogProps = (kind: Action) => ({
    open: action === kind,
    onOpenChange: (open: boolean) => setAction(open ? kind : null),
    onGone: handleGone,
  });

  return (
    <>
      {back}

      <section className="mt-6 flex flex-col gap-6 rounded-[20px] bg-white px-5 py-6 sm:gap-8 sm:px-12 sm:py-11">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-8">
          <Avatar src={detail.avatarUrl} size={120} />
          <div className="flex min-w-0 flex-col gap-2.5">
            <h1 className="text-[28px] font-bold break-words sm:text-[32px]">
              {detail.name}
            </h1>
            <p className="text-xl font-medium break-all text-foreground/75">
              {detail.email}
            </p>
            <span className="w-fit rounded-full bg-foreground/14 px-3 py-1.5 text-[15px] font-bold">
              Biên tập viên
            </span>
          </div>
        </div>

        <hr className="border-foreground/10" />

        <dl className="flex flex-col gap-4.5 text-lg">
          <InfoRow label="Nhà xuất bản">
            <Link
              to="/admin/publishers/$id"
              params={{ id: detail.publisherId }}
              className="hover:underline"
            >
              {detail.publisherName}
            </Link>
          </InfoRow>
          <InfoRow label="Trạng thái">
            <StatusCell
              status={detail.status}
              lockedLabel="Đã khóa (nhà xuất bản bị đình chỉ)"
            />
          </InfoRow>
          <InfoRow label="Mật khẩu">
            <PasswordBadge hasPassword={detail.hasPassword} />
          </InfoRow>
          <InfoRow label="Ngày tạo">{formatDateTime(detail.createdAt)}</InfoRow>
          <InfoRow label="Cập nhật">{formatDateTime(detail.updatedAt)}</InfoRow>
          <InfoRow label="Giới thiệu">
            {detail.bio ?? (
              <span className="text-foreground/45">Chưa có giới thiệu</span>
            )}
          </InfoRow>
        </dl>

        <div className="flex flex-col gap-3.5 sm:flex-row">
          {!isLocked && (
            <Button
              className={actionButton("primary")}
              onClick={() => setAction("reset")}
            >
              <KeyRound />
              Đặt lại mật khẩu
            </Button>
          )}
          <Button
            className={actionButton("danger")}
            onClick={() => setAction("delete")}
          >
            <Trash2 />
            Xóa tài khoản
          </Button>
        </div>
      </section>

      <NoteConfirmDialog
        {...dialogProps("reset")}
        title="Đặt lại mật khẩu?"
        description={`Mật khẩu hiện tại sẽ hết hiệu lực ngay và biên tập viên bị đăng xuất khỏi mọi thiết bị. Mật khẩu mới sẽ được gửi tới ${detail.email}, lý do bên dưới được ghi ở cuối email. Tối đa 3 lần mỗi ngày.`}
        placeholder="VD: Nhà xuất bản nhờ đặt lại vì biên tập viên quên mật khẩu"
        confirmLabel="Đặt lại"
        submit={(note) =>
          api(`/admin/editors/${editorId}/reset-password`, {
            method: "POST",
            auth: true,
            silent: true,
            body: { note },
          })
        }
        onDone={() => {
          toast.success(`Đã gửi mật khẩu mới tới ${detail.email}`);
          load();
        }}
      />
      <NoteConfirmDialog
        {...dialogProps("delete")}
        title={`Xóa ${detail.name}?`}
        description="Tài khoản biên tập viên sẽ bị xóa hẳn và không thể hoàn tác. Sách do biên tập viên này tạo vẫn thuộc nhà xuất bản."
        placeholder="VD: Biên tập viên lạ do kẻ xấu tạo khi tài khoản nhà xuất bản bị chiếm"
        confirmLabel="Xóa"
        kind="danger"
        submit={(note) =>
          api(`/admin/editors/${editorId}`, {
            method: "DELETE",
            auth: true,
            silent: true,
            body: { note },
          })
        }
        onDone={() => {
          toast.success(`Đã xóa ${detail.name}`);
          toList();
        }}
      />
    </>
  );
}
