import { useId, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { actionButton, AppDialog } from "@/components/app-dialog";
import { BoxedTextarea } from "@/components/boxed-textarea";
import { Button } from "@/components/ui/button";
import { ApiError, isSystemError } from "@/lib/api";
import { ERROR_CODES } from "@/lib/publishers";

const NOT_FOUND_STATUS = 404;
const SERVICE_UNAVAILABLE_STATUS = 503;
const NOTE_MAX_LENGTH = 1000;

/**
 * Hộp thoại xác nhận có ô "Lý do" bắt buộc (Figma "NXB / Xác nhận …", "BTV / Xác nhận …").
 * `submit` gọi API với `silent: true`; lỗi được xử lý ở đây:
 * - 404: đối tượng đã bị xóa trong lúc xem → `onGone`
 * - 503 (chưa đẩy được email): báo ngay trong hộp, bấm Thử lại
 * - lỗi nghiệp vụ (4xx, kể cả 429 quá số lần đặt lại mật khẩu 3003): hiện trong hộp
 * - lỗi hệ thống khác (mất mạng, 5xx, 429 do rate limit chung): toast
 */
export function NoteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  placeholder,
  confirmLabel,
  kind = "primary",
  submit,
  onDone,
  onGone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  placeholder: string;
  confirmLabel: string;
  kind?: "primary" | "danger";
  submit: (note: string) => Promise<unknown>;
  onDone: () => void;
  onGone: () => void;
}) {
  const id = useId();
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string>();
  const [error, setError] = useState<{ message: string; retry: boolean }>();
  const [isPending, setIsPending] = useState(false);

  // Mở lại thì luôn bắt đầu với ô trống
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setNote("");
      setNoteError(undefined);
      setError(undefined);
    }
    onOpenChange(next);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = note.trim();

    if (!trimmed) {
      setNoteError("Vui lòng nhập lý do");
      return;
    }

    setIsPending(true);
    setNoteError(undefined);
    setError(undefined);

    try {
      await submit(trimmed);
      handleOpenChange(false);
      onDone();
    } catch (cause) {
      if (!(cause instanceof ApiError)) {
        throw cause;
      }

      if (cause.status === NOT_FOUND_STATUS) {
        handleOpenChange(false);
        onGone();
      } else if (cause.status === SERVICE_UNAVAILABLE_STATUS) {
        // Mật khẩu cũ đã bị hủy, chỉ chưa đẩy được email: bấm lại là được
        setError({ message: "Chưa gửi được email, vui lòng thử lại.", retry: true });
      } else if (cause.code !== ERROR_CODES.PASSWORD_RESET_LIMIT && isSystemError(cause.status)) {
        toast.error(cause.message, { id: "system-error" });
      } else {
        setError({ message: cause.message, retry: false });
      }
    } finally {
      setIsPending(false);
    }
  };

  // Quá số lần trong ngày: không bấm lại được nữa
  const isBlocked = error !== undefined && !error.retry;

  return (
    <AppDialog
      open={open}
      onOpenChange={handleOpenChange}
      width={600}
      title={title}
      description={description}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        <BoxedTextarea
          id={`${id}-note`}
          label="Lý do"
          placeholder={placeholder}
          maxLength={NOTE_MAX_LENGTH}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            setNoteError(undefined);
          }}
          error={noteError}
        />
        {error && (
          <p role="alert" className="-mt-2 text-base font-semibold text-[#ff6d6d]">
            {error.message}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            className={actionButton("secondary")}
            onClick={() => handleOpenChange(false)}
          >
            Hủy
          </Button>
          <Button
            type="submit"
            disabled={isPending || isBlocked}
            className={actionButton(kind)}
          >
            {error?.retry ? "Thử lại" : confirmLabel}
          </Button>
        </div>
      </form>
    </AppDialog>
  );
}
