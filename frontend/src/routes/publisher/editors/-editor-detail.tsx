import { ArrowLeft, KeyRound, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PasswordBadge } from "@/components/admin/account-badges";
import { InfoRow } from "@/components/admin/info-row";
import { NoteConfirmDialog } from "@/components/admin/note-confirm-dialog";
import { Avatar } from "@/components/avatar";
import { actionButton } from "@/components/app-dialog";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import type { EditorDetail as Detail } from "@/lib/editors";
import { formatDateTime } from "@/lib/moderators";

const LIST_PATH = "/publisher/editors" as const;

type Confirm = "delete" | "reset" | null;

// Theo Figma "NXB / Biên tập viên / Chi tiết", "Xác nhận xóa", "Xác nhận đặt lại mật khẩu"
export function EditorDetail() {
  const { editorId } = useParams({ from: "/publisher/editors/$editorId" });
  const navigate = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const load = useCallback(() => {
    api<Detail>(`/publisher/editors/${editorId}`, { auth: true })
      .then((data) => {
        setDetail(data);
        setIsNotFound(false);
      })
      .catch((error: unknown) => {
        // 404, hoặc 400 khi id trên URL không phải uuid
        if (
          error instanceof ApiError &&
          (error.status === 404 || error.status === 400)
        ) {
          setIsNotFound(true);
        }
      });
  }, [editorId]);

  useEffect(load, [load]);

  // Đã bị xóa (tab khác) trong lúc đang xem
  const handleGone = () => {
    toast.error("Biên tập viên này không còn tồn tại");
    void navigate({ to: LIST_PATH });
  };

  const back = (
    <Link
      to={LIST_PATH}
      className="mt-5 flex w-fit items-center gap-2 text-lg font-bold hover:underline"
    >
      <ArrowLeft className="size-5.5" />
      Quay lại danh sách
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
          <InfoRow label="Mật khẩu">
            <PasswordBadge hasPassword={detail.hasPassword} />
          </InfoRow>
          <InfoRow label="Ngày thêm">{formatDateTime(detail.createdAt)}</InfoRow>
          <InfoRow label="Cập nhật">{formatDateTime(detail.updatedAt)}</InfoRow>
          <InfoRow label="Giới thiệu">
            {detail.bio ?? (
              <span className="text-foreground/45">Chưa có giới thiệu</span>
            )}
          </InfoRow>
        </dl>

        <div className="flex flex-col gap-3.5 sm:flex-row">
          <Button
            className={actionButton("primary")}
            onClick={() => setConfirm("reset")}
          >
            <KeyRound />
            Đặt lại mật khẩu
          </Button>
          <Button
            className={actionButton("danger")}
            onClick={() => setConfirm("delete")}
          >
            <Trash2 />
            Xóa biên tập viên
          </Button>
        </div>
      </section>

      <NoteConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(open) => setConfirm(open ? "delete" : null)}
        title={`Xóa ${detail.name}?`}
        description="Tài khoản biên tập viên sẽ bị xóa hẳn và được báo qua email. Không thể khôi phục. Sách do biên tập viên này tạo vẫn thuộc nhà xuất bản."
        placeholder="VD: Đã nghỉ việc"
        confirmLabel="Xóa"
        kind="danger"
        noteOptional
        submit={(note) =>
          api(`/publisher/editors/${detail.id}`, {
            method: "DELETE",
            auth: true,
            silent: true,
            body: { ...(note && { note }) },
          })
        }
        onDone={() => {
          toast.success(`Đã xóa ${detail.name}`);
          void navigate({ to: LIST_PATH });
        }}
        onGone={handleGone}
      />
      <NoteConfirmDialog
        open={confirm === "reset"}
        onOpenChange={(open) => setConfirm(open ? "reset" : null)}
        title="Đặt lại mật khẩu?"
        description={`Mật khẩu hiện tại sẽ hết hiệu lực ngay và biên tập viên bị đăng xuất khỏi mọi thiết bị. Mật khẩu mới sẽ được gửi tới ${detail.email}.`}
        placeholder="VD: Biên tập viên quên mật khẩu"
        confirmLabel="Đặt lại"
        noteOptional
        submit={(note) =>
          api(`/publisher/editors/${detail.id}/reset-password`, {
            method: "POST",
            auth: true,
            silent: true,
            body: { ...(note && { note }) },
          })
        }
        onDone={() => {
          toast.success(`Đã gửi mật khẩu mới tới ${detail.email}`);
          load();
        }}
        onGone={handleGone}
      />
    </>
  );
}
