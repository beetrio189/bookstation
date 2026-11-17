import { createRootRoute, HeadContent, Outlet } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";

// Khung gốc: tiêu đề tab theo `head` của từng route, toast lỗi hệ thống (Figma "Toast lỗi")
export const Route = createRootRoute({
  head: () => ({ meta: [{ title: "BookStation" }] }),
  component: RootLayout,
});

function RootLayout() {
  return (
    <>
      <HeadContent />
      <Outlet />
      <Toaster position="top-right" richColors />
    </>
  );
}
