import { Link, type LinkProps } from "@tanstack/react-router";
import { Menu, type LucideIcon } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { Dialog } from "radix-ui";
import { Logo } from "@/components/logo";

export interface AreaNavItem {
  to: LinkProps["to"];
  label: string;
  icon: LucideIcon;
}

interface AreaNavProps {
  home: "/admin" | "/publisher";
  // Nhãn nhỏ trên danh sách mục (QUẢN TRỊ, NHÀ XUẤT BẢN)
  label: string;
  items: AreaNavItem[];
}

const ITEM_CLASS =
  "flex items-center gap-3.5 rounded-xl px-5 py-3.5 text-lg font-semibold";

// Theo Figma "Khung quản trị": logo, nhãn khu, mục đang chọn nền đỏ
function AreaNav({ home, label, items }: AreaNavProps) {
  return (
    <>
      <Logo to={home} />
      <p className="mt-10 mb-1 text-sm font-bold text-foreground/50">{label}</p>
      <nav className="flex flex-col gap-2">
        {items.map(({ to, label, icon: Icon }) => (
          // Link tự gắn aria-current="page" khi đang ở trang đó hoặc trang con (chi tiết)
          <Link
            key={label}
            to={to}
            className={ITEM_CLASS}
            activeProps={{ className: "bg-[#ff6d6d] font-bold text-white" }}
            inactiveProps={{ className: "hover:bg-foreground/5" }}
          >
            <Icon className="size-6" />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}

const PANEL_CLASS = "flex w-75 shrink-0 flex-col gap-2 px-6 py-10";

// Màn rộng (từ lg): sidebar cố định bên trái, đứng yên khi cuộn trang
export function AreaSidebar(props: AreaNavProps) {
  return (
    <aside
      className={`${PANEL_CLASS} sticky top-0 hidden h-screen self-start overflow-y-auto border-r-2 border-foreground lg:flex`}
    >
      <AreaNav {...props} />
    </aside>
  );
}

// Màn hẹp (dưới lg): nút ☰ mở sidebar dạng ngăn trượt từ trái
export function AreaMobileNav(props: AreaNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Bấm vào bất kỳ liên kết nào trong ngăn (mục menu, logo) thì đóng ngăn
  const closeOnLink = (event: MouseEvent) => {
    if ((event.target as Element).closest("a")) {
      setIsOpen(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger
        aria-label="Mở menu"
        className="rounded-lg p-2 hover:bg-foreground/5 lg:hidden"
      >
        <Menu className="size-7" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/45 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 lg:hidden" />
        <Dialog.Content
          aria-describedby={undefined}
          onClick={closeOnLink}
          className={`${PANEL_CLASS} fixed inset-y-0 left-0 z-50 max-w-[85vw] bg-cream text-foreground outline-none data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left lg:hidden`}
        >
          <Dialog.Title className="sr-only">Menu</Dialog.Title>
          <AreaNav {...props} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
