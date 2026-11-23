import { Building2, Package, ShieldCheck } from "lucide-react";
import {
  AreaMobileNav,
  AreaSidebar,
  type AreaNavItem,
} from "@/components/area-sidebar";
import { getRole } from "@/lib/session";

const NAV: (AreaNavItem & {
  // Chỉ admin thấy (KDV không quản lý gói)
  adminOnly?: boolean;
})[] = [
  { to: "/admin/publishers", label: "Nhà xuất bản", icon: Building2 },
  { to: "/admin/moderators", label: "Kiểm duyệt viên", icon: ShieldCheck },
  { to: "/admin/plans", label: "Gói hội viên", icon: Package, adminOnly: true },
];

function navProps() {
  const isAdmin = getRole() === "admin";

  return {
    home: "/admin" as const,
    label: "QUẢN TRỊ",
    items: NAV.filter((item) => isAdmin || !item.adminOnly),
  };
}

export function AdminSidebar() {
  return <AreaSidebar {...navProps()} />;
}

export function AdminMobileNav() {
  return <AreaMobileNav {...navProps()} />;
}
