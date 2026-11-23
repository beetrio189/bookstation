import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AccountMenu } from "@/components/account-menu";
import {
  PublisherMobileNav,
  PublisherSidebar,
} from "@/components/publisher/publisher-sidebar";
import { guardArea } from "@/lib/session";

// Khu nhà xuất bản và biên tập viên, cùng khung với khu quản trị (sidebar + header)
export const Route = createFileRoute("/publisher")({
  beforeLoad: () => guardArea("publisher"),
  component: PublisherLayout,
});

function PublisherLayout() {
  return (
    <div className="flex min-h-screen bg-cream">
      <PublisherSidebar />
      <div className="flex min-w-0 flex-1 flex-col px-4 pt-4 pb-10 md:px-10 lg:pt-7.5 2xl:px-20">
        {/* Màn hẹp: nút ☰ bên trái, menu tài khoản bên phải */}
        <header className="flex items-center justify-between lg:justify-end">
          <PublisherMobileNav />
          <AccountMenu />
        </header>
        <main className="flex flex-1 flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
