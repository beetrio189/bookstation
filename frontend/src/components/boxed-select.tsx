import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// Ô chọn cùng kiểu BoxedInput: nhãn đậm trong khung bo 20, mũi tên bên phải
export function BoxedSelect({
  id,
  label,
  className,
  children,
  ...props
}: ComponentProps<"select"> & { id: string; label: string }) {
  return (
    <label
      htmlFor={id}
      className="relative flex flex-col rounded-[20px] border-2 border-foreground px-5 py-2.5 focus-within:border-primary"
    >
      <span className="text-lg/[1.3] font-bold">{label}</span>
      <select
        id={id}
        className={cn(
          "appearance-none bg-transparent pr-8 text-lg/[1.3] font-medium outline-none",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-5 size-5.5 -translate-y-1/2" />
    </label>
  );
}
