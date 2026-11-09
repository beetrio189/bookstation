import { useRef } from "react";

// Gắn ref vào ô mật khẩu và ô nhập lại, gọi check trong onChange của cả hai.
// Hai ô khác nhau thì ô nhập lại báo lỗi ngay khi submit.
export function usePasswordConfirm() {
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const check = () => {
    const confirm = confirmRef.current;

    confirm?.setCustomValidity(
      confirm.value && confirm.value !== passwordRef.current?.value
        ? "Mật khẩu nhập lại không khớp"
        : "",
    );
  };

  return { passwordRef, confirmRef, check };
}
