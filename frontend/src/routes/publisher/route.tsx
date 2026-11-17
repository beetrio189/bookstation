import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AccountMenu } from "@/components/account-menu";
import { Logo } from "@/components/logo";
import { guardArea } from "@/lib/session";

// Khu nhà xuất bản và biên tập viên. Chưa có Figma: tạm logo + menu tài khoản
export const Route = createFileRoute("/publisher")({
  beforeLoad: () => guardArea("publisher"),
  component: PublisherLayout,
});

function PublisherLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-cream px-20 pt-7.5 pb-10">
      <header className="flex items-center justify-between">
        <Logo to="/publisher" />
        <AccountMenu />
      </header>
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
