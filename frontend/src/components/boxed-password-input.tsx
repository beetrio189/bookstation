import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { BoxedInput } from "@/components/boxed-input";

// Ô mật khẩu kiểu khung (hộp thoại) có nút ẩn/hiện, theo Figma "Tài khoản / Đổi mật khẩu"
export function BoxedPasswordInput(
  props: Omit<ComponentProps<typeof BoxedInput>, "type" | "endAdornment">,
) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? Eye : EyeOff;

  return (
    <BoxedInput
      {...props}
      type={visible ? "text" : "password"}
      endAdornment={
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          aria-pressed={visible}
          className="shrink-0 rounded-md p-1 hover:bg-foreground/5"
        >
          <Icon className="size-6.5" strokeWidth={1.75} />
        </button>
      }
    />
  );
}
