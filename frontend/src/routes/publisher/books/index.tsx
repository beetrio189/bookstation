import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/publisher/books/")({
  head: () => ({ meta: [{ title: "Sách | BookStation" }] }),
  component: () => <PagePlaceholder title="Sách" />,
});
