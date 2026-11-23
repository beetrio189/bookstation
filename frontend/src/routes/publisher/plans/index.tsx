import { createFileRoute, redirect } from "@tanstack/react-router";
import { getRole } from "@/lib/session";
import { PublisherPlans } from "./-publisher-plans";

export const Route = createFileRoute("/publisher/plans/")({
  // Chỉ chủ NXB mua gói (API trả 403 cho biên tập viên): mở link thẳng thì về trang đầu khu
  beforeLoad: () => {
    if (getRole() === "editor") {
      throw redirect({ to: "/publisher" });
    }
  },
  head: () => ({ meta: [{ title: "Gói hội viên | BookStation" }] }),
  component: PublisherPlans,
});
