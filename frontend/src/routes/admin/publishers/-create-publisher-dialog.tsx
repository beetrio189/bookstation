import { CircleCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { actionButton, AppDialog } from "@/components/app-dialog";
import { BoxedInput } from "@/components/boxed-input";
import { BoxedTextarea } from "@/components/boxed-textarea";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { api, ApiError, isSystemError } from "@/lib/api";
import { ERROR_CODES } from "@/lib/publishers";

type State =
  | { step: "form"; emailError?: string; noteError?: string; formError?: string }
  | { step: "done"; email: string };

// Theo Figma "NXB / Tạo (hộp thoại)", "(lỗi email đã có tài khoản)", "(thành công)"
export function CreatePublisherDialog({
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
    const publisherName = String(form.get("publisherName")).trim();
    const note = String(form.get("note")).trim();

    // Ô chỉ có dấu cách vẫn qua được `required` của trình duyệt
    if (!note) {
      setState({ step: "form", noteError: "Vui lòng nhập ghi chú" });
      return;
    }

    setIsPending(true);
    setState({ step: "form" });

    try {
      await api("/admin/publishers", {
        method: "POST",
        auth: true,
        body: { email, publisherName, note },
      });
      setState({ step: "done", email });
      onCreated();
    } catch (error) {
      // Lỗi hệ thống đã có toast (api.ts)
      if (error instanceof ApiError && !isSystemError(error.status)) {
        setState(
          error.code === ERROR_CODES.EMAIL_ALREADY_EXISTS
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
        title={<span className="sr-only">Đã tạo nhà xuất bản</span>}
      >
        <div className="flex flex-col items-center gap-3.5 text-center">
          <CircleCheck className="size-14 text-primary" strokeWidth={1.75} />
          <p className="text-[26px] font-bold">Đã tạo nhà xuất bản</p>
          <p className="text-[17px]/[1.4] font-medium">
            Mật khẩu đăng nhập đang được gửi tới {state.email}.
          </p>
        </div>
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
      title="Tạo nhà xuất bản"
      description="Mật khẩu sẽ được tạo tự động và gửi tới email này."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <BoxedInput
          id="publisher-email"
          name="email"
          type="email"
          label="Email"
          placeholder="lienhe@nxb.vn"
          maxLength={255}
          autoComplete="off"
          required
          error={state.emailError}
        />
        <BoxedInput
          id="publisher-name"
          name="publisherName"
          label="Tên nhà xuất bản"
          placeholder="Nhà xuất bản Kim Đồng"
          maxLength={255}
          autoComplete="off"
          required
        />
        <BoxedTextarea
          id="publisher-note"
          name="note"
          label="Ghi chú"
          placeholder="Email gửi đơn và ngày gửi, VD: lienhe@kimdong.vn, gửi ngày 17/11/2026"
          maxLength={1000}
          required
          error={state.noteError}
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
