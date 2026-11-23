import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/publisher/surveys/")({
  head: () => ({ meta: [{ title: "Khảo sát | BookStation" }] }),
  component: () => <PagePlaceholder title="Khảo sát" />,
});
