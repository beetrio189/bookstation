import { createFileRoute, redirect } from "@tanstack/react-router";
import { getRole } from "@/lib/session";
import { ModeratorDetail } from "./-moderator-detail";

export const Route = createFileRoute("/admin/moderators/$id")({
  // Chi tiết chỉ dành cho admin: KDV mở link thẳng thì về danh sách
  beforeLoad: () => {
    if (getRole() === "moderator") {
      throw redirect({ to: "/admin/moderators" });
    }
  },
  head: () => ({ meta: [{ title: "Kiểm duyệt viên | BookStation" }] }),
  component: ModeratorDetail,
});
