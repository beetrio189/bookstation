import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/publisher/editors/")({
  head: () => ({ meta: [{ title: "Biên tập viên | BookStation" }] }),
  component: () => <PagePlaceholder title="Biên tập viên" />,
});
