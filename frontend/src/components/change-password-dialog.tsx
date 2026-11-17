import { CircleCheck } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { actionButton, AppDialog } from "@/components/app-dialog";
import { BoxedPasswordInput } from "@/components/boxed-password-input";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { usePasswordConfirm } from "@/hooks/use-password-confirm";
import { api, ApiError, isSystemError } from "@/lib/api";
import { setAccessToken } from "@/lib/auth-token";
import { NEW_PASSWORD_INPUT_PROPS } from "@/lib/password";

// Mã lỗi backend (backend/src/utils/errors/errors.ts)
const WRONG_PASSWORD = 2005;
const PASSWORD_NOT_SET = 2006;
const SAME_PASSWORD = 2008;
const PASSWORD_PWNED = 2009;

type State =
  | {
      step: "form";
      currentError?: string;
      newError?: string;
      formError?: string;
    }
  | { step: "done" };

/**
 * Theo Figma "Tài khoản / Đổi mật khẩu (hộp thoại | sai mật khẩu hiện tại | thành công)".
 * Mở từ menu tài khoản ở cả 3 khu. Đổi xong backend đăng xuất mọi thiết bị
 * (xóa refresh token + cookie) nên phải đăng nhập lại.
 */
export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { passwordRef, confirmRef, check } = usePasswordConfirm();
  const [state, setState] = useState<State>({ step: "form" });
  const [isPending, setIsPending] = useState(false);

  const goToLogin = () => void navigate({ to: "/login", replace: true });

  const handleOpenChange = (next: boolean) => {
    // Đã đổi xong: phiên cũ không còn, đóng hộp là về trang đăng nhập
    if (!next && state.step === "done") {
      goToLogin();
      return;
    }

    if (!next) {
      setState({ step: "form" });
    }
    onOpenChange(next);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setIsPending(true);
    setState({ step: "form" });

    try {
      await api("/auth/change-password", {
        method: "POST",
        auth: true,
        body: {
          currentPassword: String(form.get("currentPassword")),
          newPassword: String(form.get("newPassword")),
        },
      });
      // Backend đã thu hồi mọi refresh token: bỏ luôn access token đang giữ
      setAccessToken(null);
      setState({ step: "done" });
    } catch (error) {
      // Lỗi hệ thống (mất mạng, 5xx, 429 bấm quá nhanh) đã có toast (api.ts)
      if (!(error instanceof ApiError) || isSystemError(error.status)) {
        return;
      }

      if (error.code === WRONG_PASSWORD) {
        setState({ step: "form", currentError: error.message });
      } else if (
        error.code === SAME_PASSWORD ||
        error.code === PASSWORD_PWNED
      ) {
        setState({ step: "form", newError: error.message });
      } else if (error.code === PASSWORD_NOT_SET) {
        setState({
          step: "form",
          formError:
            "Tài khoản của bạn đăng nhập bằng Google nên chưa có mật khẩu để đổi.",
        });
      } else {
        setState({ step: "form", formError: error.message });
      }
    } finally {
      setIsPending(false);
    }
  };

  if (state.step === "done") {
    return (
      <AppDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={<span className="sr-only">Đã đổi mật khẩu</span>}
      >
        <div className="flex flex-col items-center gap-3.5 text-center">
          <CircleCheck className="size-14 text-primary" strokeWidth={1.75} />
          <p className="text-[26px] font-bold">Đã đổi mật khẩu</p>
          <p className="text-[17px]/[1.4] font-medium">
            Bạn đã được đăng xuất khỏi mọi thiết bị. Vui lòng đăng nhập lại bằng
            mật khẩu mới.
          </p>
        </div>
        <div className="flex justify-end">
          <Button className={actionButton("primary")} onClick={goToLogin}>
            Đăng nhập lại
          </Button>
        </div>
      </AppDialog>
    );
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Đổi mật khẩu"
      description="Đổi xong bạn sẽ bị đăng xuất khỏi mọi thiết bị và cần đăng nhập lại bằng mật khẩu mới."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Ô mật khẩu hiện tại kiểm tra như /login; ô mới như /register, /reset-password */}
        <BoxedPasswordInput
          id="current-password"
          name="currentPassword"
          label="Mật khẩu hiện tại"
          autoComplete="current-password"
          required
          error={state.currentError}
        />
        <BoxedPasswordInput
          ref={passwordRef}
          id="new-password"
          name="newPassword"
          label="Mật khẩu mới"
          autoComplete="new-password"
          {...NEW_PASSWORD_INPUT_PROPS}
          onChange={check}
          required
          error={state.newError}
          hint="8–72 ký tự, có chữ hoa, chữ thường, chữ số và ký tự đặc biệt"
        />
        <BoxedPasswordInput
          ref={confirmRef}
          id="confirm-password"
          label="Nhập lại mật khẩu mới"
          autoComplete="new-password"
          onChange={check}
          required
        />
        {state.formError && (
          <FormMessage tone="error">{state.formError}</FormMessage>
        )}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            className={actionButton("secondary")}
            onClick={() => handleOpenChange(false)}
          >
            Hủy
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className={actionButton("primary")}
          >
            Lưu
          </Button>
        </div>
      </form>
    </AppDialog>
  );
}
