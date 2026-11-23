import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { actionButton } from "@/components/app-dialog";
import { BoxedInput } from "@/components/boxed-input";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";

// MẪU THỬ cổng thanh toán SePay sandbox (chỉ dùng ở dev, không có trong Figma).
// Backend ký form, trình duyệt POST thẳng sang SePay; IPN xem trên webhook.site.

interface CheckoutForm {
  action: string;
  fields: Record<string, string>;
}

interface Search {
  result?: "success" | "error" | "cancel";
  order?: string;
}

const RESULT_TEXT = {
  success: "SePay chuyển về success_url",
  error: "SePay chuyển về error_url",
  cancel: "SePay chuyển về cancel_url (đã hủy)",
} as const;

export const Route = createFileRoute("/dev/sepay")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    result:
      search.result === "success" ||
      search.result === "error" ||
      search.result === "cancel"
        ? search.result
        : undefined,
    order: typeof search.order === "string" ? search.order : undefined,
  }),
  head: () => ({ meta: [{ title: "Thử SePay | BookStation" }] }),
  component: DevSepayPage,
});

function DevSepayPage() {
  const { result, order } = Route.useSearch();
  const [amount, setAmount] = useState("10000");
  const [checkout, setCheckout] = useState<CheckoutForm | null>(null);
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Có form đã ký thì gửi luôn sang SePay
  useEffect(() => {
    if (checkout) {
      formRef.current?.submit();
    }
  }, [checkout]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    setIsLoading(true);

    try {
      setCheckout(
        await api<CheckoutForm>("/dev/sepay-checkout", {
          method: "POST",
          body: { amount: Number(amount) },
        }),
      );
    } catch (caught) {
      setIsLoading(false);

      if (caught instanceof ApiError && caught.status === 400) {
        setError("Số tiền từ 2.000 đến 100.000.000");
      }
    }
  };

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-12">
      <h1 className="text-3xl font-bold">Thử cổng thanh toán SePay</h1>

      {result && (
        <p className="rounded-[20px] border-2 border-foreground px-5 py-3">
          <b>{RESULT_TEXT[result]}</b>
          {order && <> — đơn {order}</>}
          <br />
          Đây chỉ là chỗ quay về, kết quả thật xem payload IPN trên webhook.site.
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <BoxedInput
          id="amount"
          label="Số tiền (VND)"
          inputMode="numeric"
          value={amount}
          error={error}
          onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))}
        />
        <Button
          type="submit"
          disabled={isLoading}
          className={actionButton("primary")}
        >
          {isLoading ? "Đang chuyển sang SePay…" : "Thanh toán qua SePay"}
        </Button>
      </form>

      {/* Form ẩn: input theo đúng thứ tự backend đã ký */}
      {checkout && (
        <form ref={formRef} method="POST" action={checkout.action} hidden>
          {Object.entries(checkout.fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
        </form>
      )}
    </main>
  );
}
