import { useState, type FormEvent } from "react";
import { ApiErrorText } from "@/components/auth/api-error-text";
import { VerificationEmailSent } from "@/components/auth/verification-email-sent";
import { FormMessage } from "@/components/form-message";
import { OutlinedInput } from "@/components/outlined-input";
import { Button } from "@/components/ui/button";
import { api, ApiError, isSystemError } from "@/lib/api";

export function ResendVerificationForm() {
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<{ code: number; text: string } | null>(
    null,
  );
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email"));

    setIsPending(true);
    setError(null);

    try {
      // Luôn trả {} dù email có tồn tại hay không (chống dò email)
      await api("/auth/resend-verification", {
        method: "POST",
        body: { email },
      });
      setIsSent(true);
    } catch (caught) {
      // Lỗi hệ thống đã có toast, chỉ hiện dòng chữ cho lỗi nghiệp vụ
      if (caught instanceof ApiError && !isSystemError(caught.status)) {
        setError({ code: caught.code, text: caught.message });
      }
    } finally {
      setIsPending(false);
    }
  };

  if (isSent) {
    return (
      <VerificationEmailSent
        title="Đã gửi email xác thực!"
        resendLink={
          // Đang ở trang gửi lại nên chỉ cần quay về form
          <button
            type="button"
            onClick={() => setIsSent(false)}
            className="font-bold text-primary underline"
          >
            gửi lại email
          </button>
        }
      />
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-100 flex-col gap-5 leading-tight"
    >
      <div>
        <h1 className="text-[30px] font-bold">Gửi lại email xác thực</h1>
        <p className="text-base/5 font-medium">
          Nhập email để nhận lại đường link xác thực
        </p>
      </div>

      <OutlinedInput
        id="email"
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        required
      />

      {error && (
        <FormMessage tone="error">
          <ApiErrorText {...error} />
        </FormMessage>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="h-12.5 rounded-lg text-xl font-bold"
      >
        Gửi email
      </Button>
    </form>
  );
}
