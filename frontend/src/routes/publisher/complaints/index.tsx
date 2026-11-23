import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/publisher/complaints/")({
  head: () => ({ meta: [{ title: "Khiếu nại | BookStation" }] }),
  component: () => <PagePlaceholder title="Khiếu nại" />,
});
