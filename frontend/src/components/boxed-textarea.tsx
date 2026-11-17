import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// Ô nhập nhiều dòng cùng kiểu BoxedInput (ô "Ghi chú" / "Lý do" trong hộp thoại quản trị)
export function BoxedTextarea({
  id,
  label,
  error,
  className,
  ...props
}: ComponentProps<"textarea"> & { id: string; label: string; error?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className={cn(
          "flex flex-col rounded-[20px] border-2 border-foreground px-5 py-2.5 focus-within:border-primary",
          error && "border-[#ff6d6d] focus-within:border-[#ff6d6d]",
        )}
      >
        <span className="text-lg/[1.3] font-bold">{label}</span>
        <textarea
          id={id}
          rows={3}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "resize-none bg-transparent text-lg/[1.3] font-medium outline-none placeholder:text-foreground/45",
            className,
          )}
          {...props}
        />
      </label>
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-[15px] font-semibold text-[#ff6d6d]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
