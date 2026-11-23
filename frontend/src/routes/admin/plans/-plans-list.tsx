import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { NoteConfirmDialog } from "@/components/admin/note-confirm-dialog";
import { actionButton } from "@/components/app-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import {
  formatNumber,
  formatPrice,
  groupPlans,
  isFreePlan,
  planTitle,
  type PlanItem,
} from "@/lib/plans";
import { cn } from "@/lib/utils";
import { PlanFormDialog } from "./-plan-form-dialog";

const SMALL_BUTTON =
  "rounded-[10px] border-2 px-5 py-1.5 text-base font-bold transition-colors";

// Thẻ gói theo component Figma "Thẻ gói"
function PlanCard({
  plan,
  onEdit,
  onDelete,
}: {
  plan: PlanItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="flex flex-col gap-3.5 rounded-[20px] bg-white px-7 py-6.5">
      <h3 className="text-[22px] font-bold break-words">{plan.name}</h3>
      <p className="text-[28px] font-bold text-primary">
        {formatPrice(plan.price)}
      </p>
      <hr className="border-foreground/8" />
      <div className="flex flex-col gap-1.5 text-[17px] font-medium">
        <p>Tối đa {formatNumber(plan.bookLimit)} sách</p>
        <p>Tối đa {formatNumber(plan.editorLimit)} biên tập viên</p>
      </div>
      {/* flex-1 đẩy nút xuống đáy để các thẻ cùng hàng thẳng nút */}
      <p className="flex-1 text-base font-medium break-words whitespace-pre-line text-foreground/60">
        {plan.description}
      </p>
      <div className="flex justify-end gap-2.5">
        <button
          type="button"
          onClick={onEdit}
          className={cn(SMALL_BUTTON, "border-foreground hover:bg-foreground/5")}
        >
          Sửa
        </button>
        {/* Gói Free không xóa được */}
        {!isFreePlan(plan) && (
          <button
            type="button"
            onClick={onDelete}
            className={cn(
              SMALL_BUTTON,
              "border-[#ff6d6d] text-[#ff6d6d] hover:bg-[#ff6d6d]/8",
            )}
          >
            Xóa
          </button>
        )}
      </div>
    </article>
  );
}

// Theo Figma "Gói / Danh sách": thẻ nhóm theo thời hạn, gói Free ở nhóm "Mặc định"
export function PlansList() {
  const [items, setItems] = useState<PlanItem[] | null>(null);
  // undefined: đóng; null: thêm gói; PlanItem: sửa gói đó
  const [editing, setEditing] = useState<PlanItem | null | undefined>();
  const [deleting, setDeleting] = useState<PlanItem | null>(null);

  const load = useCallback(() => {
    api<{ items: PlanItem[] }>("/admin/plans", { auth: true })
      .then(({ items }) => setItems(items))
      .catch(() => undefined);
  }, []);

  useEffect(load, [load]);

  // Gói đã bị admin khác xóa trong lúc đang sửa / xóa
  const handleGone = () => {
    setEditing(undefined);
    toast.error("Gói này không còn tồn tại");
    load();
  };

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 sm:mt-7">
        <h1 className="text-[28px] font-bold sm:text-[32px]">Gói hội viên</h1>
        <Button
          className={cn(actionButton("primary"), "shrink-0")}
          onClick={() => setEditing(null)}
        >
          <Plus strokeWidth={2.5} />
          Thêm gói
        </Button>
      </div>

      {items === null && (
        <p className="mt-6 text-lg font-medium text-foreground/50">
          Đang tải...
        </p>
      )}

      <div className="mt-6 flex flex-col gap-10 sm:mt-8">
        {items &&
          groupPlans(items).map(({ label, plans }) => (
            <section key={label} className="flex flex-col gap-4">
              <h2 className="text-[22px] font-bold">{label}</h2>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {plans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    onEdit={() => setEditing(plan)}
                    onDelete={() => setDeleting(plan)}
                  />
                ))}
              </div>
            </section>
          ))}
      </div>

      {editing !== undefined && (
        <PlanFormDialog
          plan={editing ?? undefined}
          onClose={() => setEditing(undefined)}
          onSaved={(message) => {
            setEditing(undefined);
            toast.success(message);
            load();
          }}
          onGone={handleGone}
        />
      )}

      {deleting && (
        <NoteConfirmDialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          title={`Xóa gói ${planTitle(deleting)}?`}
          description="Gói sẽ ngừng bán ngay và không thể khôi phục. Nhà xuất bản đang dùng gói vẫn giữ hạn mức đến hết kỳ và sẽ nhận email thông báo."
          placeholder={`VD: Ngừng bán gói ${planTitle(deleting)} từ quý 2`}
          confirmLabel="Xóa gói"
          kind="danger"
          submit={(note) =>
            api(`/admin/plans/${deleting.id}`, {
              method: "DELETE",
              auth: true,
              silent: true,
              body: { note },
            })
          }
          onDone={() => {
            toast.success(`Đã xóa gói ${planTitle(deleting)}`);
            load();
          }}
          onGone={handleGone}
        />
      )}
    </>
  );
}
