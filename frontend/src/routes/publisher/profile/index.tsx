import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/publisher/profile/")({
  head: () => ({ meta: [{ title: "Trang nhà xuất bản | BookStation" }] }),
  component: () => <PagePlaceholder title="Trang nhà xuất bản" />,
});
