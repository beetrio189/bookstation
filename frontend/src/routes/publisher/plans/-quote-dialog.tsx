import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { actionButton, AppDialog } from "@/components/app-dialog";
import { WarningBox } from "@/components/publisher/warning-box";
import { Button } from "@/components/ui/button";
import { api, ApiError, isSystemError } from "@/lib/api";
import {
  PAYMENT_ERROR_CODES,
  submitCheckoutForm,
  type CreatePaymentResult,
} from "@/lib/payments";
import {
  formatNumber,
  planFullName,
  PURCHASE_ERROR_CODES,
  type PlanQuote,
  type PublisherPlan,
} from "@/lib/plans";
import { cn } from "@/lib/utils";

const money = (value: number) => `${formatNumber(value)} đ`;

// Một dòng "nhãn — số tiền" theo component Figma "Dòng số tiền"
function Row({
  label,
  value,
  kind = "normal",
}: {
  label: string;
  value: string;
  kind?: "normal" | "sub" | "total";
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4",
        kind === "normal" && "text-lg font-medium",
        kind === "sub" && "pl-5 text-base font-medium text-foreground/60",
        kind === "total" && "text-[22px] font-bold",
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "shrink-0",
          kind === "normal" && "font-bold",
          kind === "total" && "text-primary",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Theo Figma "NXB / Gói / Xác nhận mua": số tiền nếu mua gói ngay bây giờ
 * (GET /publisher/plans/:id/quote). total = 0 thì trả hết bằng credit, nút
 * "Xác nhận" và thêm dòng credit còn lại.
 * Bấm nút: POST /publisher/payments. Đơn CR… thành công ngay → trang kết quả;
 * đơn BS… → gửi form SePay (rời trang).
 */
export function QuoteDialog({
  plan,
  currentPlanName,
  onClose,
  onStale,
}: {
  plan: PublisherPlan;
  // Không có khi NXB đang dùng gói Free
  currentPlanName?: string;
  onClose: () => void;
  // Danh sách đã cũ (gói bị xóa, mức dùng đổi, đang có đơn chờ): đóng hộp thoại, báo lỗi và tải lại
  onStale: (message: string) => void;
}) {
  const navigate = useNavigate();
  const [quote, setQuote] = useState<PlanQuote | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleError = (error: unknown) => {
    if (!(error instanceof ApiError) || isSystemError(error.status)) {
      // Lỗi hệ thống đã có toast
      onClose();
    } else if (error.status === 404) {
      onStale("Gói này không còn tồn tại");
    } else if (
      error.code === PURCHASE_ERROR_CODES.PLAN_LIMIT_EXCEEDED ||
      error.code === PURCHASE_ERROR_CODES.PLAN_NOT_PURCHASABLE ||
      // Đang có đơn chờ: tải lại để hiện thanh báo đơn chờ
      error.code === PAYMENT_ERROR_CODES.PENDING_PAYMENT_EXISTS
    ) {
      onStale(error.message);
    } else {
      onClose();
    }
  };

  const buy = () => {
    setSubmitting(true);
    api<CreatePaymentResult>("/publisher/payments", {
      method: "POST",
      body: { planId: plan.id },
      auth: true,
    })
      .then((result) => {
        if ("checkout" in result) {
          // Giữ nút ở trạng thái đang gửi cho tới khi trình duyệt rời trang
          submitCheckoutForm(result.checkout);
          return;
        }

        void navigate({
          to: "/publisher/payments/$id",
          params: { id: result.id },
          search: { result: "success" },
        });
      })
      .catch((error: unknown) => {
        setSubmitting(false);
        handleError(error);
      });
  };

  useEffect(() => {
    api<PlanQuote>(`/publisher/plans/${plan.id}/quote`, { auth: true })
      .then(setQuote)
      .catch(handleError);
    // Chỉ tính một lần khi mở hộp thoại
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id]);

  const isCreditOnly = quote?.total === 0;
  const available = quote ? quote.creditBalance + quote.creditReturned : 0;

  const note = isCreditOnly
    ? `Gói được trả hết bằng credit, không cần thanh toán. ${
        currentPlanName
          ? `Gói hiện tại (${currentPlanName}) kết thúc và gói mới bắt đầu ngay khi bấm Xác nhận.`
          : "Gói mới bắt đầu ngay khi bấm Xác nhận."
      }`
    : currentPlanName
      ? `Gói hiện tại (${currentPlanName}) sẽ kết thúc ngay khi thanh toán thành công. Phần chưa dùng đã được quy ra credit ở trên. Gói mới bắt đầu từ lúc thanh toán.`
      : "Gói mới bắt đầu từ lúc thanh toán thành công.";

  return (
    <AppDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Mua gói ${planFullName(plan)}?`}
      description={`Tối đa ${formatNumber(plan.bookLimit)} sách · ${formatNumber(plan.editorLimit)} biên tập viên`}
      width={560}
    >
      {quote === null ? (
        <p className="text-lg font-medium text-foreground/50">Đang tính...</p>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-[14px] bg-cream p-5">
            <Row label="Giá gốc" value={money(quote.price)} />
            <Row label="Credit hiện có" value={money(available)} />
            <Row
              label="· Còn dư"
              value={money(quote.creditBalance)}
              kind="sub"
            />
            <Row
              label="· Hoàn từ gói đang dùng"
              value={money(quote.creditReturned)}
              kind="sub"
            />
            <Row
              label="Credit sử dụng"
              value={`− ${money(quote.creditUsed)}`}
            />
            <hr className="border-foreground/20" />
            <Row label="Tổng phí" value={money(quote.total)} kind="total" />
            {isCreditOnly && (
              <Row
                label="Credit còn lại sau khi mua"
                value={money(available - quote.creditUsed)}
                kind="sub"
              />
            )}
          </div>
          <p className="text-base font-medium text-foreground/70">{note}</p>
          {/* Đơn trả hết bằng credit thành công ngay, không chuyển khoản nên không cảnh báo */}
          {!isCreditOnly && (
            <WarningBox>
              Đơn có hiệu lực 15 phút. Chúng tôi không chịu trách nhiệm nếu bạn
              chuyển khoản sau thời hạn hoặc sai số tiền.
            </WarningBox>
          )}
        </>
      )}

      <div className="flex justify-end gap-3">
        <Button
          className={actionButton("secondary")}
          disabled={submitting}
          onClick={onClose}
        >
          Hủy
        </Button>
        <Button
          className={actionButton("primary")}
          disabled={quote === null || submitting}
          onClick={buy}
        >
          {isCreditOnly ? "Xác nhận" : "Thanh toán"}
        </Button>
      </div>
    </AppDialog>
  );
}
