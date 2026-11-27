import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { PublisherBookDetail } from "@/lib/books";
import { BookForm } from "../-book-form";

export const Route = createFileRoute("/publisher/books/$bookId/edit")({
  head: () => ({ meta: [{ title: "Sửa sách | BookStation" }] }),
  component: EditBookPage,
});

function EditBookPage() {
  const { bookId } = Route.useParams();
  // undefined: đang tải; null: không có sách này (đã xóa, của NXB khác, id sai)
  const [book, setBook] = useState<PublisherBookDetail | null>();

  useEffect(() => {
    api<PublisherBookDetail>(`/publisher/books/${bookId}`, { auth: true })
      .then(setBook)
      .catch((cause: unknown) => {
        // 404, hoặc 400 khi id không phải uuid
        if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500 && cause.status !== 429) {
          setBook(null);
        }
      });
  }, [bookId]);

  if (book === undefined) {
    return (
      <p className="mt-7 text-lg font-medium text-foreground/50">Đang tải...</p>
    );
  }

  if (book === null) {
    return (
      <div className="mt-7 flex flex-col items-start gap-3">
        <p className="text-lg font-medium">Không tìm thấy sách này.</p>
        <Link
          to="/publisher/books"
          className="text-base font-bold text-primary hover:underline"
        >
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  // key: đổi sách (id trên URL) thì form bắt đầu lại từ dữ liệu mới
  return <BookForm key={book.id} book={book} />;
}
