import { XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

// Hộp thoại theo Figma khu quản trị: nền mờ tối, hộp trắng bo 20, tiêu đề 26 + nút đóng
export function AppDialog({
  open,
  onOpenChange,
  title,
  description,
  width = 600,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Không có tiêu đề (màn kết quả) thì vẫn cần tên cho trình đọc màn hình
  title: ReactNode;
  description?: ReactNode;
  width?: number;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/45 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          style={{ width }}
          className="fixed top-1/2 left-1/2 z-50 flex max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-6 max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[20px] bg-white px-6 py-7 sm:px-9 sm:py-8 text-foreground shadow-[0_12px_40px_rgba(0,0,0,0.18)] outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95"
          // Không có mô tả thì báo rõ cho Radix, tránh cảnh báo thiếu Description
          {...(!description && { "aria-describedby": undefined })}
        >
          <div className="flex items-center justify-between gap-4">
            <DialogPrimitive.Title className="text-[22px] font-bold sm:text-[26px]">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Đóng"
              className="rounded-md p-1 hover:bg-foreground/5"
            >
              <XIcon className="size-6" />
            </DialogPrimitive.Close>
          </div>
          {description && (
            <DialogPrimitive.Description className="text-[17px]/[1.4] font-medium text-foreground/75">
              {description}
            </DialogPrimitive.Description>
          )}
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// Nút theo Figma khu quản trị: cao 50, bo 10, chữ đậm 18. Dùng làm className của <Button>
const BUTTON_KINDS = {
  primary: "",
  secondary:
    "border-2 border-foreground bg-transparent text-foreground hover:bg-foreground/5",
  danger: "bg-[#ff6d6d] text-white hover:bg-[#ff6d6d]/85",
  // Hành động không hoàn tác được nằm cạnh nút đỏ đặc (Figma "Xóa nhà xuất bản")
  dangerOutline:
    "border-2 border-[#ff6d6d] bg-white text-[#ff6d6d] hover:bg-[#ff6d6d]/8",
};

export const actionButton = (kind: keyof typeof BUTTON_KINDS) =>
  cn(
    "h-12.5 min-w-30 gap-2.5 rounded-[10px] px-7 text-lg font-bold [&_svg:not([class*='size-'])]:size-5",
    BUTTON_KINDS[kind],
  );
