import { createFileRoute } from "@tanstack/react-router";
import { PublisherDetail } from "./-publisher-detail";

export const Route = createFileRoute("/admin/publishers/$id/")({
  head: () => ({ meta: [{ title: "Nhà xuất bản | BookStation" }] }),
  component: PublisherDetail,
});
