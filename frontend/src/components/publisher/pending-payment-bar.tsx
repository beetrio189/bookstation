import { ClockIcon } from "lucide-react";
import { actionButton } from "@/components/app-dialog";
import { Button } from "@/components/ui/button";
import {
  formatDateTime,
  formatMoney,
  type PendingPayment,
} from "@/lib/payments";
import { planFullName } from "@/lib/plans";

/**
 * Theo component Figma "Thanh báo đơn chờ": nền đỏ nhạt cho khẩn cấp,
 * [Hủy đơn] [Tiếp tục thanh toán]. Đơn đã quá hạn (job chưa quét) vẫn hiện để hủy.
 */
export function PendingPaymentBar({
  payment,
  busy,
  onCancel,
  onContinue,
}: {
  payment: PendingPayment;
  // Đang gọi checkout: khóa hai nút
  busy: boolean;
  onCancel: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-[14px] border-2 border-[#dc2626] bg-[#fef2f2] px-6 py-5 lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <ClockIcon className="size-7 shrink-0 text-[#dc2626]" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-lg font-bold">
            {`Bạn có đơn chờ thanh toán: Gói ${planFullName({
              name: payment.planName,
              durationMonths: payment.durationMonths,
            })} · ${formatMoney(payment.total)}`}
          </p>
          <p className="text-base font-medium text-foreground/70">
            Mã đơn {payment.orderCode} · Hết hạn lúc{" "}
            {formatDateTime(payment.expiresAt)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-3">
        <Button
          className={actionButton("secondary")}
          disabled={busy}
          onClick={onCancel}
        >
          Hủy đơn
        </Button>
        <Button
          className={actionButton("primary")}
          disabled={busy}
          onClick={onContinue}
        >
          Tiếp tục thanh toán
        </Button>
      </div>
    </div>
  );
}
