import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthResult } from "@/components/auth/auth-result";
import { FormMessage } from "@/components/form-message";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { usePasswordConfirm } from "@/hooks/use-password-confirm";
import { api, ApiError, isSystemError } from "@/lib/api";
import { NEW_PASSWORD_INPUT_PROPS } from "@/lib/password";

const INVALID_TOKEN = 2004;

type Message = { code: number; text: string };

// uid, token lấy từ link trong email: /reset-password?uid=...&token=...
export function ResetPasswordForm({
  uid,
  token,
}: {
  uid?: string;
  token?: string;
}) {
  const { passwordRef, confirmRef, check } = usePasswordConfirm();
  const navigate = useNavigate();
  const [message, setMessage] = useState<Message | null>(null);
  const [isPending, setIsPending] = useState(false);

  if (!uid || !token) {
    return <InvalidResetLink />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const newPassword = String(new FormData(formElement).get("newPassword"));

    setIsPending(true);
    setMessage(null);

    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: { uid, token, newPassword },
      });
      void navigate({ to: "/reset-password/done" });
    } catch (caught) {
      // Lỗi hệ thống đã có toast, chỉ hiện dòng chữ cho lỗi nghiệp vụ
      if (caught instanceof ApiError && !isSystemError(caught.status)) {
        setMessage({ code: caught.code, text: caught.message });
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
        <h1 className="text-[30px] font-bold">Tạo mật khẩu mới</h1>
        <p className="text-base/5 font-medium">
          Mật khẩu mới của bạn phải khác với mật khẩu đã sử dụng trước đó
        </p>
      </div>

      <PasswordInput
        ref={passwordRef}
        id="new-password"
        name="newPassword"
        label="Mật khẩu mới"
        autoComplete="new-password"
        {...NEW_PASSWORD_INPUT_PROPS}
        onChange={check}
        required
      />
      <PasswordInput
        ref={confirmRef}
        id="confirm-password"
        label="Nhập lại mật khẩu"
        autoComplete="new-password"
        onChange={check}
        required
      />

      {message && (
        <FormMessage tone="error">
          {message.text}
          {/* Link đã dùng/hết hạn: không sửa được bằng cách nhập lại, phải xin link mới */}
          {message.code === INVALID_TOKEN && (
            <>
              {" "}
              <Link
                to="/forgot-password"
                className="font-bold text-primary underline"
              >
                Gửi lại link đặt lại mật khẩu
              </Link>
            </>
          )}
        </FormMessage>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="h-12.5 rounded-lg text-xl font-bold"
      >
        Lưu
      </Button>
    </form>
  );
}

// Mở /reset-password không có uid/token (link bị cắt, gõ tay URL)
function InvalidResetLink() {
  return (
    <AuthResult
      title="Liên kết không hợp lệ"
      action={{
        to: "/forgot-password",
        label: "Gửi lại link đặt lại mật khẩu",
      }}
    >
      Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu gửi lại link đặt lại
      mật khẩu để nhận liên kết mới.
    </AuthResult>
  );
}
