import { ArrowLeft, KeyRound, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PasswordBadge } from "@/components/admin/account-badges";
import { InfoRow } from "@/components/admin/info-row";
import { Avatar } from "@/components/avatar";
import { actionButton, AppDialog } from "@/components/app-dialog";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import {
  formatDateTime,
  ROLE_LABELS,
  type ModeratorDetail as Detail,
} from "@/lib/moderators";

const LIST_PATH = "/admin/moderators" as const;
const NOT_FOUND_STATUS = 404;
const SERVICE_UNAVAILABLE_STATUS = 503;

type Confirm = "delete" | "reset" | null;

// Theo Figma "KDV / Chi tiết (kiểm duyệt viên)" và "(quản trị viên, không có nút)"
export function ModeratorDetail() {
  const { id } = useParams({ from: "/admin/moderators/$id" });
  const navigate = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const load = useCallback(() => {
    api<Detail>(`/admin/moderators/${id}`, { auth: true })
      .then((data) => {
        setDetail(data);
        setIsNotFound(false);
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === NOT_FOUND_STATUS) {
          setIsNotFound(true);
        }
      });
  }, [id]);

  useEffect(load, [load]);

  // Đã bị xóa (bởi người khác) trong lúc đang xem
  const handleGone = () => {
    toast.error("Kiểm duyệt viên này không còn tồn tại");
    void navigate({ to: LIST_PATH });
  };

  const back = (
    <Link
      to={LIST_PATH}
      className="mt-5 flex w-fit items-center gap-2 text-lg font-bold hover:underline"
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
          Không tìm thấy kiểm duyệt viên này.
        </p>
      </>
    );
  }

  if (!detail) {
    return back;
  }

  // Chỉ thao tác được trên KDV, không trên admin
  const canManage = detail.role === "moderator";

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
              {ROLE_LABELS[detail.role]}
            </span>
          </div>
        </div>

        <hr className="border-foreground/10" />

        <dl className="flex flex-col gap-4.5 text-lg">
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

        {canManage && (
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
              Xóa tài khoản
            </Button>
          </div>
        )}
      </section>

      {canManage && (
        <>
          <DeleteDialog
            open={confirm === "delete"}
            onOpenChange={(open) => setConfirm(open ? "delete" : null)}
            detail={detail}
            onDeleted={() => {
              toast.success(`Đã xóa ${detail.name}`);
              void navigate({ to: LIST_PATH });
            }}
            onGone={handleGone}
          />
          <ResetPasswordDialog
            open={confirm === "reset"}
            onOpenChange={(open) => setConfirm(open ? "reset" : null)}
            detail={detail}
            onDone={() => {
              setConfirm(null);
              toast.success(`Đã gửi mật khẩu mới tới ${detail.email}`);
              load();
            }}
            onGone={handleGone}
          />
        </>
      )}
    </>
  );
}

interface ConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: Detail;
  onGone: () => void;
}

// Theo Figma "KDV / Xác nhận xóa"
function DeleteDialog({
  detail,
  onDeleted,
  onGone,
  ...dialog
}: ConfirmProps & { onDeleted: () => void }) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsPending(true);
    setError(null);

    try {
      await api(`/admin/moderators/${detail.id}`, {
        method: "DELETE",
        auth: true,
      });
      onDeleted();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === NOT_FOUND_STATUS) {
        onGone();
      } else if (cause instanceof ApiError && cause.status < 500) {
        setError(cause.message);
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AppDialog
      {...dialog}
      width={560}
      title={`Xóa ${detail.name}?`}
      description="Tài khoản sẽ bị xóa hẳn và không thể hoàn tác, kiểm duyệt viên sẽ nhận email thông báo. Nhớ gỡ ủy quyền Gmail của email này trên hộp thư BookStation."
    >
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <div className="flex justify-end gap-3">
        <Button
          className={actionButton("secondary")}
          onClick={() => dialog.onOpenChange(false)}
        >
          Hủy
        </Button>
        <Button
          className={actionButton("danger")}
          disabled={isPending}
          onClick={() => void handleDelete()}
        >
          Xóa
        </Button>
      </div>
    </AppDialog>
  );
}

// Theo Figma "KDV / Xác nhận đặt lại mật khẩu" và "(lỗi gửi email)"
function ResetPasswordDialog({
  detail,
  onDone,
  onGone,
  ...dialog
}: ConfirmProps & { onDone: () => void }) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (open: boolean) => {
    setError(null);
    dialog.onOpenChange(open);
  };

  const handleReset = async () => {
    setIsPending(true);
    setError(null);

    try {
      // Lỗi hiện ngay trong hộp thoại (có nút Thử lại) nên không cần toast
      await api(`/admin/moderators/${detail.id}/reset-password`, {
        method: "POST",
        auth: true,
        silent: true,
      });
      onDone();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === NOT_FOUND_STATUS) {
        onGone();
      } else if (
        cause instanceof ApiError &&
        cause.status === SERVICE_UNAVAILABLE_STATUS
      ) {
        // Mật khẩu cũ đã bị hủy, chỉ chưa đẩy được email: bấm lại là được
        setError("Chưa gửi được email, vui lòng thử lại.");
      } else if (cause instanceof ApiError) {
        setError(cause.message);
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AppDialog
      open={dialog.open}
      onOpenChange={handleOpenChange}
      width={560}
      title="Đặt lại mật khẩu?"
      description={`Mật khẩu hiện tại sẽ hết hiệu lực ngay và kiểm duyệt viên bị đăng xuất khỏi mọi thiết bị. Mật khẩu mới sẽ được gửi tới ${detail.email}.`}
    >
      {error && (
        <p role="alert" className="-mt-2 text-base font-semibold text-[#ff6d6d]">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <Button
          className={actionButton("secondary")}
          onClick={() => handleOpenChange(false)}
        >
          Hủy
        </Button>
        <Button
          className={actionButton("primary")}
          disabled={isPending}
          onClick={() => void handleReset()}
        >
          {error ? "Thử lại" : "Đặt lại"}
        </Button>
      </div>
    </AppDialog>
  );
}
