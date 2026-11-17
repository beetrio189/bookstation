import type { AccountStatus } from "@/lib/publishers";
import { cn } from "@/lib/utils";

const BADGE = "w-fit rounded-full px-3 py-1.5 text-[15px] font-bold";

// Đã nhận / Chưa nhận mật khẩu (worker đã gửi mật khẩu hay chưa, hoặc vừa bị đặt lại)
export function PasswordBadge({ hasPassword }: { hasPassword: boolean }) {
  return (
    <span
      className={cn(
        BADGE,
        hasPassword
          ? "bg-primary/14 text-primary"
          : "bg-[#ff6d6d]/14 text-[#ff6d6d]",
      )}
    >
      {hasPassword ? "Đã nhận" : "Chưa nhận"}
    </span>
  );
}

// Nhãn trạng thái: NXB bị khóa gọi là "Đình chỉ", biên tập viên bị khóa theo NXB là "Đã khóa"
export function StatusBadge({
  status,
  lockedLabel = "Đình chỉ",
}: {
  status: AccountStatus;
  lockedLabel?: string;
}) {
  return status === "locked" ? (
    <span className={cn(BADGE, "bg-[#ff6d6d]/14 text-[#ff6d6d]")}>
      {lockedLabel}
    </span>
  ) : (
    <span className={cn(BADGE, "bg-foreground/14")}>Hoạt động</span>
  );
}

// Dạng chữ cho cột Trạng thái trong bảng (Figma: "Hoạt động" chữ thường, "Đình chỉ" là nhãn đỏ)
export function StatusCell({
  status,
  lockedLabel = "Đình chỉ",
}: {
  status: AccountStatus;
  lockedLabel?: string;
}) {
  return status === "locked" ? (
    <span className={cn(BADGE, "bg-[#ff6d6d]/14 text-[#ff6d6d]")}>
      {lockedLabel}
    </span>
  ) : (
    <span className="text-[17px] font-semibold">Hoạt động</span>
  );
}
