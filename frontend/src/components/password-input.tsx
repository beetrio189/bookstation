"use client";

import { Eye } from "lucide-react";
import Image from "next/image";
import { useState, type ComponentProps } from "react";
import { OutlinedInput } from "@/components/outlined-input";

type PasswordInputProps = Omit<
  ComponentProps<typeof OutlinedInput>,
  "type" | "endAdornment"
>;

// Ô mật khẩu có nút ẩn/hiện
export function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <OutlinedInput
      {...props}
      type={visible ? "text" : "password"}
      endAdornment={
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          aria-pressed={visible}
          className="flex size-7.5 items-center justify-center rounded-md"
        >
          {visible ? (
            <Eye className="size-7.5" strokeWidth={1.5} />
          ) : (
            <Image src="/icons/eye-hide.svg" alt="" width={30} height={30} />
          )}
        </button>
      }
    />
  );
}
