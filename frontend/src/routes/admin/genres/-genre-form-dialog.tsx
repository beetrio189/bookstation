import { useState, type FormEvent } from "react";
import { actionButton, AppDialog } from "@/components/app-dialog";
import { BoxedInput } from "@/components/boxed-input";
import { BoxedTextarea } from "@/components/boxed-textarea";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { api, ApiError, isSystemError } from "@/lib/api";
import {
  GENRE_ERROR_CODES,
  GENRE_NAME_MAX_LENGTH,
  normalizeGenreName,
  type AdminGenreItem,
} from "@/lib/genres";

const NOT_FOUND_STATUS = 404;
const NOTE_MAX_LENGTH = 1000;

/**
 * Thêm thể loại (không truyền `genre`) hoặc đổi tên. Theo Figma "Thể loại / Thêm (hộp thoại)",
 * "Thể loại / Thêm (lỗi thể loại đã tồn tại)", "Thể loại / Sửa (hộp thoại)".
 * Sửa: tên sau chuẩn hóa giống hệt tên cũ thì nút Lưu bị khóa.
 */
export function GenreFormDialog({
  genre,
  onClose,
  onSaved,
  onGone,
}: {
  genre?: AdminGenreItem;
  onClose: () => void;
  onSaved: (message: string) => void;
  onGone: () => void;
}) {
  const isEdit = genre !== undefined;
  const [name, setName] = useState(genre?.name ?? "");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ name?: string; form?: string }>({});
  const [isPending, setIsPending] = useState(false);

  const normalized = normalizeGenreName(name);
  const isUnchanged = isEdit && normalized === genre.name;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!normalized) {
      setErrors({ name: "Vui lòng nhập tên thể loại" });
      return;
    }

    const trimmedNote = note.trim();
    const body = { name: normalized, ...(trimmedNote && { note: trimmedNote }) };

    setIsPending(true);
    setErrors({});

    try {
      if (isEdit) {
        await api(`/admin/genres/${genre.id}`, {
          method: "PATCH",
          auth: true,
          body,
        });
        onSaved(`Đã đổi tên thể loại thành "${normalized}"`);
      } else {
        await api("/admin/genres", { method: "POST", auth: true, body });
        onSaved(`Đã thêm thể loại "${normalized}"`);
      }
    } catch (error) {
      // Lỗi hệ thống đã có toast (api.ts)
      if (!(error instanceof ApiError) || isSystemError(error.status)) {
        return;
      }

      if (isEdit && error.status === NOT_FOUND_STATUS) {
        onGone();
      } else if (error.code === GENRE_ERROR_CODES.GENRE_ALREADY_EXISTS) {
        setErrors({ name: error.message });
      } else {
        setErrors({ form: error.message });
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AppDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={isEdit ? `Sửa thể loại "${genre.name}"` : "Thêm thể loại"}
      description={`Không phân biệt hoa thường và dấu: "Kinh tế" và "kinh te" là cùng một thể loại.`}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        <BoxedInput
          id="genre-name"
          label="Tên thể loại"
          placeholder="VD: Kinh tế"
          maxLength={GENRE_NAME_MAX_LENGTH}
          autoComplete="off"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setErrors({});
          }}
          error={errors.name}
        />
        <BoxedTextarea
          id="genre-note"
          label="Ghi chú (không bắt buộc)"
          placeholder="VD: Bổ sung theo đề xuất của nhà xuất bản"
          rows={2}
          maxLength={NOTE_MAX_LENGTH}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        {isEdit && (
          <p className="rounded-xl bg-primary/10 px-4 py-3 text-base/[1.4] font-semibold text-[#0078c8]">
            Đổi tên thì đường dẫn của thể loại cũng đổi theo, link cũ sẽ không
            mở được.
          </p>
        )}
        {errors.form && <FormMessage tone="error">{errors.form}</FormMessage>}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            className={actionButton("secondary")}
            onClick={onClose}
          >
            Hủy
          </Button>
          <Button
            type="submit"
            disabled={isPending || isUnchanged}
            className={actionButton("primary")}
          >
            {isEdit ? "Lưu" : "Thêm"}
          </Button>
        </div>
      </form>
    </AppDialog>
  );
}
