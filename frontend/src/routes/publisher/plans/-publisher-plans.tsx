import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PlanSummaryCard } from "@/components/plan-summary-card";
import { PendingPaymentBar } from "@/components/publisher/pending-payment-bar";
import { Button } from "@/components/ui/button";
import { api, ApiError, isSystemError } from "@/lib/api";
import {
  submitCheckoutForm,
  type PendingPayment,
  type SepayCheckoutForm,
} from "@/lib/payments";
import {
  formatDate,
  formatNumber,
  groupPlans,
  isFreePlan,
  planFullName,
  type CurrentSubscription,
  type PublisherPlan,
} from "@/lib/plans";
import { CancelPaymentDialog } from "./-cancel-payment-dialog";
import { QuoteDialog } from "./-quote-dialog";

// Gói hiện tại và mức đang dùng / giới hạn: "120/200.000 sách · 3/5 biên tập viên"
function CurrentPlan({ subscription }: { subscription: CurrentSubscription }) {
  const { current, usage } = subscription;

  return (
    <div className="flex flex-col gap-1.5 text-lg">
      <p className="font-bold">
        Gói hiện tại:{" "}
        {planFullName({
          name: current.planName,
          durationMonths: current.durationMonths,
        })}
        {current.periodEndsAt &&
          ` · hết hạn ${formatDate(current.periodEndsAt)}`}
      </p>
      <p className="font-medium">
        Đang dùng: {formatNumber(usage.books)}/{formatNumber(current.bookLimit)}{" "}
        sách · {formatNumber(usage.editors)}/{formatNumber(current.editorLimit)}{" "}
        biên tập viên
      </p>
    </div>
  );
}

/**
 * Theo Figma "NXB / Gói / Danh sách": gói hiện tại + các gói nhóm theo thời hạn.
 * Gói Free hiện ở nhóm "Mặc định", chỉ để xem (không nút Chọn); gói trả phí
 * canBuy = false thì làm mờ. Có đơn chờ thanh toán thì hiện thanh báo đỏ phía trên.
 */
export function PublisherPlans() {
  const [subscription, setSubscription] = useState<CurrentSubscription | null>(
    null,
  );
  const [items, setItems] = useState<PublisherPlan[] | null>(null);
  const [pending, setPending] = useState<PendingPayment | null>(null);
  const [buying, setBuying] = useState<PublisherPlan | null>(null);
  const [continuing, setContinuing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      api<CurrentSubscription>("/publisher/subscription", { auth: true }),
      api<{ items: PublisherPlan[] }>("/publisher/plans", { auth: true }),
      api<{ payment?: PendingPayment }>("/publisher/payments/pending", {
        auth: true,
      }),
    ])
      .then(([current, { items }, { payment }]) => {
        setSubscription(current);
        setItems(items);
        setPending(payment ?? null);
      })
      .catch(() => undefined);
  }, []);

  useEffect(load, [load]);

  // "Tiếp tục thanh toán": không mở hộp thoại, xin lại form SePay của đơn rồi gửi luôn
  const continuePayment = (payment: PendingPayment) => {
    setContinuing(true);
    api<{ checkout: SepayCheckoutForm }>(
      `/publisher/payments/${payment.id}/checkout`,
      { method: "POST", auth: true },
    )
      .then(({ checkout }) => submitCheckoutForm(checkout))
      .catch((error: unknown) => {
        setContinuing(false);

        // Đơn đã hết hạn / không còn chờ: báo rồi tải lại (lỗi hệ thống đã có toast)
        if (error instanceof ApiError && !isSystemError(error.status)) {
          toast.error(error.message);
          load();
        }
      });
  };

  return (
    <>
      <h1 className="mt-5 text-[28px] font-bold sm:mt-7 sm:text-[32px]">
        Gói hội viên
      </h1>

      {subscription && (
        <div className="mt-4">
          <CurrentPlan subscription={subscription} />
        </div>
      )}

      {pending && (
        <div className="mt-6">
          <PendingPaymentBar
            payment={pending}
            busy={continuing}
            onCancel={() => setCancelling(true)}
            onContinue={() => continuePayment(pending)}
          />
        </div>
      )}

      {items === null && (
        <p className="mt-6 text-lg font-medium text-foreground/50">
          Đang tải...
        </p>
      )}

      {items?.length === 0 && (
        <p className="mt-6 text-lg font-medium text-foreground/50">
          Hiện chưa có gói nào.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-10 sm:mt-8">
        {items &&
          groupPlans(items).map(({ label, plans }) => (
            <section key={label} className="flex flex-col gap-4">
              <h2 className="text-[22px] font-bold">{label}</h2>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {plans.map((plan) =>
                  // Gói Free (nhóm "Mặc định"): chỉ để xem, không mua, không làm mờ
                  isFreePlan(plan) ? (
                    <PlanSummaryCard
                      key={plan.id}
                      title={plan.name}
                      plan={plan}
                    />
                  ) : (
                    // Đã có tiêu đề nhóm thời hạn nên thẻ chỉ ghi tên gói
                    <PlanSummaryCard
                      key={plan.id}
                      title={plan.name}
                      plan={plan}
                      dimmed={!plan.canBuy}
                    >
                      {!plan.canBuy && (
                        <p className="text-base font-medium text-[#ff6d6d]">
                          Số sách hoặc biên tập viên hiện có vượt giới hạn của
                          gói này
                        </p>
                      )}
                      <Button
                        disabled={!plan.canBuy}
                        onClick={() => setBuying(plan)}
                        className="h-10 w-full rounded-[10px] text-base font-bold disabled:bg-[#c7c7c7] disabled:opacity-100"
                      >
                        Chọn
                      </Button>
                    </PlanSummaryCard>
                  ),
                )}
              </div>
            </section>
          ))}
      </div>

      {pending && cancelling && (
        <CancelPaymentDialog
          payment={pending}
          onClose={() => setCancelling(false)}
          onDone={() => {
            setCancelling(false);
            load();
          }}
        />
      )}

      {buying && (
        <QuoteDialog
          plan={buying}
          currentPlanName={
            subscription && !isFreePlan(subscription.current)
              ? planFullName({
                  name: subscription.current.planName,
                  durationMonths: subscription.current.durationMonths,
                })
              : undefined
          }
          onClose={() => setBuying(null)}
          onStale={(message) => {
            setBuying(null);
            toast.error(message);
            load();
          }}
        />
      )}
    </>
  );
}
