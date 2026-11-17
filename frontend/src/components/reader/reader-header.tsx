import { Link } from "@tanstack/react-router";
import { Menu, Search, X } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { Dialog } from "radix-ui";
import { AccountMenu } from "@/components/account-menu";
import { Logo } from "@/components/logo";
import { SearchBox } from "@/components/reader/search-box";
import { MOCK_GENRES } from "@/lib/reader-mock";
import { getRole } from "@/lib/session";

const LOGIN_CLASS =
  "rounded-[10px] border-[1.5px] border-primary bg-white px-6 py-2.5 text-lg font-bold text-primary hover:bg-primary/5";
const REGISTER_CLASS =
  "rounded-[10px] border-[1.5px] border-primary bg-primary px-6 py-2.5 text-lg font-bold text-white hover:bg-primary-light";

// Màn hẹp: ☰ mở ngăn trượt gồm thể loại và đăng nhập/đăng ký
function ReaderMobileNav({ isGuest }: { isGuest: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  const closeOnLink = (event: MouseEvent) => {
    if ((event.target as Element).closest("a")) {
      setIsOpen(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger
        aria-label="Mở menu"
        className="-ml-1.5 rounded-lg p-1.5 hover:bg-foreground/5 md:hidden"
      >
        <Menu className="size-7" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/45 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 md:hidden" />
        <Dialog.Content
          aria-describedby={undefined}
          onClick={closeOnLink}
          className="fixed inset-y-0 left-0 z-50 flex w-75 max-w-[85vw] flex-col gap-6 overflow-y-auto bg-cream px-6 py-8 text-foreground outline-none data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left md:hidden"
        >
          <Dialog.Title className="sr-only">Menu</Dialog.Title>
          <Logo textClassName="text-2xl" />
          {isGuest && (
            <div className="flex flex-col gap-2.5">
              <Link to="/login" className={`${LOGIN_CLASS} text-center`}>
                Đăng nhập
              </Link>
              <Link to="/register" className={`${REGISTER_CLASS} text-center`}>
                Đăng ký
              </Link>
            </div>
          )}
          <nav className="flex flex-col gap-1">
            <p className="mb-1 text-sm font-bold text-foreground/50">THỂ LOẠI</p>
            {MOCK_GENRES.map((genre) => (
              <span
                key={genre.id}
                className="rounded-xl px-3 py-2.5 text-lg font-semibold"
              >
                {genre.name}
              </span>
            ))}
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Header khu độc giả (Figma "Trang chủ (mới)"): logo, ô tìm kiếm, đăng nhập/đăng ký hoặc menu tài khoản
export function ReaderHeader() {
  const isGuest = !getRole();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-cream/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-480 items-center gap-2.5 px-4 py-3 md:gap-8 md:px-10 md:py-5 2xl:px-25">
        <ReaderMobileNav isGuest={isGuest} />
        <Logo
          textClassName="text-xl md:text-[26px]"
          className="gap-2 [&_img]:size-8 md:[&_img]:size-10"
        />
        <SearchBox className="mx-auto hidden w-full max-w-160 md:block" />

        <div className="ml-auto flex items-center gap-2 md:ml-0 md:gap-3">
          <button
            type="button"
            aria-label={isSearchOpen ? "Đóng tìm kiếm" : "Tìm kiếm"}
            onClick={() => setIsSearchOpen((open) => !open)}
            className="rounded-lg p-1.5 hover:bg-foreground/5 md:hidden"
          >
            {isSearchOpen ? <X className="size-6" /> : <Search className="size-6" />}
          </button>

          {isGuest ? (
            <>
              <Link
                to="/login"
                className={`${LOGIN_CLASS} hidden md:block`}
              >
                Đăng nhập
              </Link>
              <Link
                to="/register"
                className={`${REGISTER_CLASS} hidden md:block`}
              >
                Đăng ký
              </Link>
              {/* Màn hẹp chỉ còn một nút nhỏ, Đăng ký nằm trong ☰ */}
              <Link
                to="/login"
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-white md:hidden"
              >
                Đăng nhập
              </Link>
            </>
          ) : (
            <AccountMenu />
          )}
        </div>
      </div>

      {isSearchOpen && (
        <div className="px-4 pb-3 md:hidden">
          <SearchBox autoFocus />
        </div>
      )}
    </header>
  );
}
