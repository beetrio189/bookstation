import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type OutlinedInputProps = React.ComponentProps<typeof Input> & {
  id: string;
  label: string;
  // Nút hoặc icon nằm bên phải trong ô
  endAdornment?: React.ReactNode;
};

// Ô nhập viền đậm, nhãn nằm đè lên viền trên (theo Figma)
export function OutlinedInput({
  id,
  label,
  endAdornment,
  className,
  ...props
}: OutlinedInputProps) {
  return (
    <div className="relative w-full pt-2.5">
      <Input
        id={id}
        className={cn(
          "h-12.5 rounded-lg border-2 border-foreground px-5 text-base md:text-base",
          endAdornment && "pr-15",
          className,
        )}
        {...props}
      />
      <label
        htmlFor={id}
        className="absolute top-0 left-3 bg-background px-1.25 text-base leading-5 font-semibold"
      >
        {label}
      </label>
      {endAdornment && (
        <div className="absolute top-2.5 right-5 flex h-12.5 items-center">
          {endAdornment}
        </div>
      )}
    </div>
  );
}
