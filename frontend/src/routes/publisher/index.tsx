import { createFileRoute, redirect } from "@tanstack/react-router";

// /publisher chưa có trang tổng quan: vào thẳng mục đầu tiên trên sidebar
export const Route = createFileRoute("/publisher/")({
  beforeLoad: () => {
    throw redirect({ to: "/publisher/books" });
  },
});
