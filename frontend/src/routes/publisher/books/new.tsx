import { createFileRoute } from "@tanstack/react-router";
import { BookForm } from "./-book-form";

export const Route = createFileRoute("/publisher/books/new")({
  head: () => ({ meta: [{ title: "Thêm sách | BookStation" }] }),
  component: () => <BookForm />,
});
