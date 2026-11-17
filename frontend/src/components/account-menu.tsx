import { ChevronDown, KeyRound, LogOut, UserRound } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DropdownMenu } from "radix-ui";
import { Avatar } from "@/components/avatar";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { api } from "@/lib/api";
import { hasLocalLogin, logout } from "@/lib/session";

interface Me {
  name: string;
  // Backend bỏ trường null khỏi response
  avatarUrl?: string;
}

const itemClass =
  "flex cursor-pointer items-center gap-3 rounded-[10px] px-3.5 py-3 text-[17px] font-semibold outline-none select-none data-disabled:cursor-default data-disabled:opacity-40 data-highlighted:bg-cream";

// Avatar + tên ở góc phải header (khu quản trị, NXB, độc giả), bấm mở menu tài khoản (Figma "Khung quản trị")
export function AccountMenu() {
  const navigate = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const canChangePassword = hasLocalLogin();

  useEffect(() => {
    api<Me>("/users/me", { auth: true, silent: true })
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  const handleLogout = async () => {
    await logout().catch(() => undefined);
    void navigate({ to: "/login", replace: true });
  };

  return (
    <>
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger className="flex items-center gap-2.5 rounded-full py-1.5 pr-3 pl-2 outline-none data-[state=open]:bg-white">
          <Avatar src={me?.avatarUrl} size={60} />
          {/* Màn hẹp chỉ hiện avatar */}
          <span className="hidden text-xl font-bold sm:inline">
            {me?.name ?? ""}
          </span>
          <ChevronDown className="size-5.5" />
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={12}
            className="z-50 flex w-65 flex-col gap-1 rounded-[14px] border border-foreground/15 bg-white p-2.5 text-foreground shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
          >
            {/* Trang này chưa làm */}
            <DropdownMenu.Item disabled className={itemClass}>
              <UserRound className="size-5" />
              Thông tin của tôi
            </DropdownMenu.Item>
            {/* Tài khoản chỉ đăng nhập Google: không có mật khẩu để đổi */}
            {canChangePassword && (
              <DropdownMenu.Item
                className={itemClass}
                onSelect={() => setIsChangingPassword(true)}
              >
                <KeyRound className="size-5" />
                Đổi mật khẩu
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Separator className="my-1 h-px bg-foreground/12" />
            <DropdownMenu.Item
              className={`${itemClass} text-[#ff6d6d]`}
              onSelect={handleLogout}
            >
              <LogOut className="size-5" />
              Đăng xuất
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <ChangePasswordDialog
        open={isChangingPassword}
        onOpenChange={setIsChangingPassword}
      />
    </>
  );
}
