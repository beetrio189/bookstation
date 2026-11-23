import { createFileRoute, redirect } from "@tanstack/react-router";
import { getRole } from "@/lib/session";
import { PlansList } from "./-plans-list";

export const Route = createFileRoute("/admin/plans/")({
  // Chỉ admin quản lý gói: KDV mở link thẳng thì về trang đầu khu quản trị
  beforeLoad: () => {
    if (getRole() === "moderator") {
      throw redirect({ to: "/admin" });
    }
  },
  head: () => ({ meta: [{ title: "Gói hội viên | BookStation" }] }),
  component: PlansList,
});
