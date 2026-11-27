import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { actionButton, AppDialog } from "@/components/app-dialog";
import { BoxedInput } from "@/components/boxed-input";
import { BoxedTextarea } from "@/components/boxed-textarea";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { api, ApiError, isSystemError } from "@/lib/api";
import { EDITOR_ERROR_CODES } from "@/lib/editors";

const NOTE_MAX_LENGTH = 1000;

// Theo Figma "NXB / Biên tập viên / Thêm (hộp thoại)"
export function CreateEditorDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [errors, setErrors] = useState<{ email?: string; form?: string }>({});
  const [isPending, setIsPending] = useState(false);

  // Mở lại thì luôn bắt đầu từ form trống
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setErrors({});
    }
    onOpenChange(next);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")).trim();
    const note = String(form.get("note")).trim();

    setIsPending(true);
    setErrors({});

    try {
      await api("/publisher/editors", {
        method: "POST",
        auth: true,
        body: {
          email,
          name: String(form.get("name")).trim(),
          ...(note && { note }),
        },
      });
      toast.success(`Đã thêm biên tập viên, mật khẩu đang được gửi tới ${email}`);
      handleOpenChange(false);
      onCreated();
    } catch (error) {
      // Lỗi hệ thống đã có toast (api.ts)
      if (error instanceof ApiError && !isSystemError(error.status)) {
        setErrors(
          error.code === EDITOR_ERROR_CODES.EMAIL_ALREADY_EXISTS
            ? { email: "Email này đã có tài khoản đăng nhập bằng mật khẩu" }
            : { form: error.message },
        );
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Thêm biên tập viên"
      description="Mật khẩu được tạo tự động và gửi tới email này. Biên tập viên đăng nhập bằng email."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <BoxedInput
          id="editor-email"
          name="email"
          type="email"
          label="Email"
          placeholder="VD: a@kimdong.vn"
          maxLength={255}
          autoComplete="off"
          required
          error={errors.email}
        />
        <BoxedInput
          id="editor-name"
          name="name"
          label="Họ và tên"
          placeholder="VD: Nguyễn Văn A"
          maxLength={100}
          autoComplete="off"
          required
        />
        <BoxedTextarea
          id="editor-note"
          name="note"
          label="Ghi chú (không bắt buộc)"
          placeholder="VD: Phụ trách mảng truyện tranh"
          maxLength={NOTE_MAX_LENGTH}
        />
        {errors.form && <FormMessage tone="error">{errors.form}</FormMessage>}
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
            Thêm
          </Button>
        </div>
      </form>
    </AppDialog>
  );
}
