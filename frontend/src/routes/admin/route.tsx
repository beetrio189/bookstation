import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AccountMenu } from "@/components/account-menu";
import {
  AdminMobileNav,
  AdminSidebar,
} from "@/components/admin/admin-sidebar";
import { guardArea } from "@/lib/session";

// Khu quản trị cho admin và kiểm duyệt viên (Figma "Khung quản trị")
export const Route = createFileRoute("/admin")({
  beforeLoad: () => guardArea("admin"),
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-cream">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col px-4 pt-4 pb-10 md:px-10 lg:pt-7.5 2xl:px-20">
        {/* Màn hẹp: nút ☰ bên trái, menu tài khoản bên phải */}
        <header className="flex items-center justify-between lg:justify-end">
          <AdminMobileNav />
          <AccountMenu />
        </header>
        <main className="flex flex-1 flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
