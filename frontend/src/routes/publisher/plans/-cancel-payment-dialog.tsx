import { useState } from "react";
import { toast } from "sonner";
import { actionButton, AppDialog } from "@/components/app-dialog";
import { Button } from "@/components/ui/button";
import { api, ApiError, isSystemError } from "@/lib/api";
import {
  formatMoney,
  PAYMENT_ERROR_CODES,
  type PendingPayment,
} from "@/lib/payments";
import { planFullName } from "@/lib/plans";

/**
 * Theo Figma "NXB / Gói / Hủy đơn (hộp thoại)". POST /publisher/payments/:id/cancel:
 * backend hỏi SePay trước, đơn đã trả thì báo 4006 thay vì hủy.
 */
export function CancelPaymentDialog({
  payment,
  onClose,
  onDone,
}: {
  payment: PendingPayment;
  onClose: () => void;
  // Đơn đã chốt (hủy xong / đã trả / không còn chờ): đóng hộp thoại và tải lại trang gói
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const cancel = () => {
    setSubmitting(true);
    api(`/publisher/payments/${payment.id}/cancel`, {
      method: "POST",
      auth: true,
    })
      .then(() => {
        toast.success("Đã hủy đơn thanh toán");
        onDone();
      })
      .catch((error: unknown) => {
        setSubmitting(false);

        if (!(error instanceof ApiError) || isSystemError(error.status)) {
          // Lỗi hệ thống đã có toast, đơn vẫn chờ: giữ hộp thoại để thử lại
          return;
        }

        if (error.code === PAYMENT_ERROR_CODES.PAYMENT_ALREADY_PAID) {
          toast.success(error.message);
        } else {
          toast.error(error.message);
        }
        onDone();
      });
  };

  return (
    <AppDialog
      open
      onOpenChange={(open) => !open && !submitting && onClose()}
      title="Hủy đơn thanh toán?"
      description={`Đơn ${payment.orderCode} · Gói ${planFullName({
        name: payment.planName,
        durationMonths: payment.durationMonths,
      })} · ${formatMoney(payment.total)}`}
      width={560}
    >
      <p className="text-lg font-medium">Bạn có chắc muốn hủy đơn này?</p>
      <div className="flex justify-end gap-3">
        <Button
          className={actionButton("secondary")}
          disabled={submitting}
          onClick={onClose}
        >
          Quay lại
        </Button>
        <Button
          className={actionButton("danger")}
          disabled={submitting}
          onClick={cancel}
        >
          Hủy đơn
        </Button>
      </div>
    </AppDialog>
  );
}
