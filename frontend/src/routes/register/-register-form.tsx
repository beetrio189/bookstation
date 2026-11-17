import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { FormMessage } from "@/components/form-message";
import { OutlinedInput } from "@/components/outlined-input";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { usePasswordConfirm } from "@/hooks/use-password-confirm";
import { api, ApiError, isSystemError } from "@/lib/api";
import { NEW_PASSWORD_INPUT_PROPS } from "@/lib/password";

// Khớp với RegisterDto của backend
const NAME_MAX_LENGTH = 100;

export function RegisterForm() {
  const { passwordRef, confirmRef, check } = usePasswordConfirm();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    setIsPending(true);
    setError(null);

    try {
      // Thành công chỉ trả {}, mail xác thực đi qua queue
      await api("/auth/register", {
        method: "POST",
        body: {
          name: String(form.get("name")),
          email: String(form.get("email")),
          password: String(form.get("password")),
        },
      });
      void navigate({ to: "/register/sent" });
    } catch (caught) {
      // Lỗi hệ thống đã có toast, chỉ hiện dòng chữ cho lỗi nghiệp vụ
      if (caught instanceof ApiError && !isSystemError(caught.status)) {
        setError(caught.message);
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-100 flex-col gap-5 leading-tight"
    >
      <div>
        <h1 className="text-[30px] font-bold">Đăng ký</h1>
        <p className="text-base/5 font-medium">
          Đăng ký tài khoản để tương tác cùng chúng tôi
        </p>
      </div>

      <OutlinedInput
        id="name"
        name="name"
        label="Tên tài khoản"
        autoComplete="name"
        maxLength={NAME_MAX_LENGTH}
        required
      />
      <OutlinedInput
        id="email"
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        required
      />
      <PasswordInput
        ref={passwordRef}
        id="password"
        name="password"
        label="Mật khẩu"
        autoComplete="new-password"
        {...NEW_PASSWORD_INPUT_PROPS}
        onChange={check}
        required
      />
      <PasswordInput
        ref={confirmRef}
        id="confirm-password"
        label="Nhập lại Mật khẩu"
        autoComplete="new-password"
        onChange={check}
        required
      />

      {error && <FormMessage tone="error">{error}</FormMessage>}

      <Button
        type="submit"
        disabled={isPending}
        className="h-12.5 rounded-lg text-xl font-bold"
      >
        Đăng ký
      </Button>
    </form>
  );
}
