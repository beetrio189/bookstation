import { NoteConfirmDialog } from "@/components/admin/note-confirm-dialog";
import { api } from "@/lib/api";
import type { PublisherBookItem } from "@/lib/books";
import { formatNumber } from "@/lib/plans";

// Figma "NXB / Sách / Xác nhận xóa": lý do không bắt buộc, nói rõ mất bao nhiêu đánh giá
export function DeleteBookDialog({
  book,
  onClose,
  onDone,
  onGone,
}: {
  book: Pick<PublisherBookItem, "id" | "title" | "coverPublicId" | "ratingCount">;
  onClose: () => void;
  onDone: () => void;
  onGone: () => void;
}) {
  const lost = [
    "Sách",
    ...(book.coverPublicId ? ["ảnh bìa"] : []),
    ...(book.ratingCount > 0
      ? [`toàn bộ ${formatNumber(book.ratingCount)} đánh giá của độc giả`]
      : []),
  ];
  const subject =
    lost.length === 1
      ? lost[0]
      : `${lost.slice(0, -1).join(", ")} và ${lost[lost.length - 1]}`;

  return (
    <NoteConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Xóa sách "${book.title}"?`}
      description={`${subject} sẽ bị xóa. Không thể khôi phục.`}
      placeholder="VD: Ngừng phát hành"
      confirmLabel="Xóa sách"
      kind="danger"
      noteOptional
      submit={(note) =>
        api(`/publisher/books/${book.id}`, {
          method: "DELETE",
          auth: true,
          silent: true,
          body: { ...(note && { note }) },
        })
      }
      onDone={onDone}
      onGone={onGone}
    />
  );
}
