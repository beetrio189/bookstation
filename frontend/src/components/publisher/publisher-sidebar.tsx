import {
  BookOpen,
  Building2,
  ClipboardList,
  Flag,
  Package,
  Users,
} from "lucide-react";
import {
  AreaMobileNav,
  AreaSidebar,
  type AreaNavItem,
} from "@/components/area-sidebar";
import { getRole } from "@/lib/session";

// Theo Figma "NXB / Gói / Danh sách"
const NAV: (AreaNavItem & {
  // Chỉ chủ NXB thấy (biên tập viên không mua gói)
  publisherOnly?: boolean;
})[] = [
  { to: "/publisher/books", label: "Sách", icon: BookOpen },
  { to: "/publisher/editors", label: "Biên tập viên", icon: Users },
  { to: "/publisher/surveys", label: "Khảo sát", icon: ClipboardList },
  { to: "/publisher/complaints", label: "Khiếu nại", icon: Flag },
  {
    to: "/publisher/plans",
    label: "Gói hội viên",
    icon: Package,
    publisherOnly: true,
  },
  { to: "/publisher/profile", label: "Trang nhà xuất bản", icon: Building2 },
];

function navProps() {
  const isOwner = getRole() === "publisher";

  return {
    home: "/publisher" as const,
    label: "NHÀ XUẤT BẢN",
    items: NAV.filter((item) => isOwner || !item.publisherOnly),
  };
}

export function PublisherSidebar() {
  return <AreaSidebar {...navProps()} />;
}

export function PublisherMobileNav() {
  return <AreaMobileNav {...navProps()} />;
}
