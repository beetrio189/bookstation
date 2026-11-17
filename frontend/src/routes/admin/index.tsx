import { createFileRoute, redirect } from "@tanstack/react-router";

// /admin chưa có trang tổng quan: vào thẳng mục đầu tiên trên sidebar
export const Route = createFileRoute("/admin/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/publishers" });
  },
});
