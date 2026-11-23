import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

// Ô nhập kiểu màn Cài đặt / hộp thoại quản trị: nhãn đậm nằm trong khung bo 20
export function BoxedInput({
  id,
  label,
  error,
  hint,
  endAdornment,
  className,
  ...props
}: ComponentProps<"input"> & {
  id: string;
  label: string;
  error?: string;
  // Dòng chữ xám dưới ô (luật mật khẩu…); có lỗi thì hiện lỗi thay
  hint?: string;
  // Nút nằm bên phải trong khung (ẩn/hiện mật khẩu)
  endAdornment?: ReactNode;
}) {
  const note = error ?? hint;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className={cn(
          "flex items-center gap-3 rounded-[20px] border-2 border-foreground px-5 py-2.5 focus-within:border-primary",
          // Ô không sửa được (Figma "Gói / Sửa"): viền nhạt, nền xám
          "has-disabled:border-foreground/15 has-disabled:bg-foreground/4",
          error && "border-[#ff6d6d] focus-within:border-[#ff6d6d]",
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-lg/[1.3] font-bold">{label}</span>
          <input
            id={id}
            aria-invalid={error ? true : undefined}
            aria-describedby={note ? `${id}-note` : undefined}
            className={cn(
              "bg-transparent text-lg/[1.3] font-medium outline-none placeholder:text-foreground/45 disabled:text-foreground/60",
              className,
            )}
            {...props}
          />
        </span>
        {endAdornment}
      </label>
      {note && (
        <p
          id={`${id}-note`}
          role={error ? "alert" : undefined}
          className={cn(
            "text-[15px] font-semibold",
            error ? "text-[#ff6d6d]" : "text-foreground/55",
          )}
        >
          {note}
        </p>
      )}
    </div>
  );
}
