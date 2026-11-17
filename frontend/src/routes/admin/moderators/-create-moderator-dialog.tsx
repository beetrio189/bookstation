import { CircleCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { actionButton, AppDialog } from "@/components/app-dialog";
import { BoxedInput } from "@/components/boxed-input";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { api, ApiError, isSystemError } from "@/lib/api";

const EMAIL_ALREADY_EXISTS = 2000;

type State =
  | { step: "form"; emailError?: string; formError?: string }
  | { step: "done"; email: string };

// Theo Figma "KDV / Tạo (hộp thoại)", "(lỗi email đã có tài khoản)", "(thành công)"
export function CreateModeratorDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [state, setState] = useState<State>({ step: "form" });
  const [isPending, setIsPending] = useState(false);

  // Mở lại thì luôn bắt đầu từ form trống
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setState({ step: "form" });
    }
    onOpenChange(next);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")).trim();

    setIsPending(true);
    setState({ step: "form" });

    try {
      await api("/admin/moderators", {
        method: "POST",
        auth: true,
        body: { email, name: String(form.get("name")).trim() },
      });
      setState({ step: "done", email });
      onCreated();
    } catch (error) {
      // Lỗi hệ thống đã có toast (api.ts)
      if (error instanceof ApiError && !isSystemError(error.status)) {
        setState(
          error.code === EMAIL_ALREADY_EXISTS
            ? {
                step: "form",
                emailError: "Email này đã có tài khoản đăng nhập bằng mật khẩu",
              }
            : { step: "form", formError: error.message },
        );
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
        title={<span className="sr-only">Đã tạo kiểm duyệt viên</span>}
      >
        <div className="flex flex-col items-center gap-3.5 text-center">
          <CircleCheck className="size-14 text-primary" strokeWidth={1.75} />
          <p className="text-[26px] font-bold">Đã tạo kiểm duyệt viên</p>
          <p className="text-[17px]/[1.4] font-medium">
            Mật khẩu đăng nhập đang được gửi tới {state.email}.
          </p>
        </div>
        <p className="rounded-xl bg-primary/10 px-4.5 py-3.5 text-base/[1.4] font-semibold">
          Nhớ vào Gmail của hộp thư BookStation để thêm ủy quyền cho email này,
          kiểm duyệt viên mới đọc được thư của nhà xuất bản.
        </p>
        <div className="flex justify-end">
          <Button
            className={actionButton("primary")}
            onClick={() => handleOpenChange(false)}
          >
            Đóng
          </Button>
        </div>
      </AppDialog>
    );
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Tạo kiểm duyệt viên"
      description="Mật khẩu sẽ được tạo tự động và gửi tới email này."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <BoxedInput
          id="moderator-email"
          name="email"
          type="email"
          label="Email"
          placeholder="ten@bookstation.vn"
          maxLength={255}
          autoComplete="off"
          required
          error={state.emailError}
        />
        <BoxedInput
          id="moderator-name"
          name="name"
          label="Họ và tên"
          placeholder="Nguyễn Văn A"
          maxLength={100}
          autoComplete="off"
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
            Tạo
          </Button>
        </div>
      </form>
    </AppDialog>
  );
}
