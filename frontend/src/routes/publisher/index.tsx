import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/publisher/")({
  head: () => ({ meta: [{ title: "Nhà xuất bản | BookStation" }] }),
  component: () => <PagePlaceholder title="Khu nhà xuất bản" />,
});
