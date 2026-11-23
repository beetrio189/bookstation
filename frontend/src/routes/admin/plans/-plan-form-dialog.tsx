import { useState, type FormEvent } from "react";
import { actionButton, AppDialog } from "@/components/app-dialog";
import { BoxedInput } from "@/components/boxed-input";
import { BoxedSelect } from "@/components/boxed-select";
import { BoxedTextarea } from "@/components/boxed-textarea";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { api, ApiError, isSystemError } from "@/lib/api";
import {
  durationLabel,
  formatPrice,
  isFreePlan,
  isValidPlanName,
  normalizePlanName,
  PLAN_DESCRIPTION_MAX_LENGTH,
  PLAN_DURATION_MONTHS,
  PLAN_ERROR_CODES,
  PLAN_NAME_MAX_LENGTH,
  PLAN_NUMBER_MAX,
  planTitle,
  type PlanItem,
} from "@/lib/plans";

const NOT_FOUND_STATUS = 404;
const NOTE_MAX_LENGTH = 1000;

interface Values {
  name: string;
  durationMonths: string;
  price: string;
  bookLimit: string;
  editorLimit: string;
  description: string;
  note: string;
}

type Errors = Partial<Record<keyof Values | "form", string>>;

const toValues = (plan?: PlanItem): Values => ({
  name: plan?.name ?? "",
  durationMonths: String(plan?.durationMonths ?? PLAN_DURATION_MONTHS[0]),
  price: plan ? String(plan.price) : "",
  bookLimit: plan ? String(plan.bookLimit) : "",
  editorLimit: plan ? String(plan.editorLimit) : "",
  description: plan?.description ?? "",
  note: "",
});

// Ô chỉ nhận chữ số: chuỗi rỗng = chưa nhập
const checkNumber = (value: string, label: string, min: number) => {
  if (value === "") {
    return `Vui lòng nhập ${label.toLowerCase()}`;
  }

  const number = Number(value);

  if (number < min) {
    return min > 0 ? `${label} phải lớn hơn 0` : `${label} không được âm`;
  }

  return number > PLAN_NUMBER_MAX ? `${label} quá lớn` : undefined;
};

function validate(values: Values, isFree: boolean): Errors {
  const name = normalizePlanName(values.name);
  const errors: Errors = {
    name: !name
      ? "Vui lòng nhập tên gói"
      : !isValidPlanName(name)
        ? "Tên gói chỉ gồm chữ cái không dấu, chữ số và dấu cách"
        : undefined,
    price: isFree ? undefined : checkNumber(values.price, "Giá", 1),
    bookLimit: checkNumber(values.bookLimit, "Số sách tối đa", 0),
    editorLimit: checkNumber(values.editorLimit, "Số biên tập viên tối đa", 0),
    note: values.note.trim() ? undefined : "Vui lòng nhập ghi chú",
  };

  return Object.fromEntries(
    Object.entries(errors).filter(([, message]) => message),
  ) as Errors;
}

/**
 * Thêm gói (không truyền `plan`) hoặc sửa gói. Theo Figma "Gói / Thêm (hộp thoại)",
 * "Gói / Thêm (lỗi gói đã tồn tại)", "Gói / Sửa (hộp thoại)", "Gói / Sửa (gói Free)".
 * Sửa: không đổi được thời hạn (gói Free cũng không đổi được giá), chỉ gửi các
 * trường đã đổi; chưa đổi gì thì nút Lưu bị khóa.
 */
export function PlanFormDialog({
  plan,
  onClose,
  onSaved,
  onGone,
}: {
  plan?: PlanItem;
  onClose: () => void;
  onSaved: (message: string) => void;
  onGone: () => void;
}) {
  const isEdit = plan !== undefined;
  const isFree = plan !== undefined && isFreePlan(plan);
  const [values, setValues] = useState(() => toValues(plan));
  const [errors, setErrors] = useState<Errors>({});
  const [isPending, setIsPending] = useState(false);

  const set =
    (field: keyof Values, digitsOnly = false) =>
    (event: { target: { value: string } }) => {
      const value = digitsOnly
        ? event.target.value.replace(/\D/g, "")
        : event.target.value;
      setValues((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
    };

  const initial = toValues(plan);
  const name = normalizePlanName(values.name);
  const description = values.description.trim();

  // Chỉ các trường đã đổi (sửa); thêm thì gửi đủ
  const changes = {
    ...(name !== initial.name && { name }),
    ...(!isFree && values.price !== initial.price && { price: Number(values.price) }),
    ...(values.bookLimit !== initial.bookLimit && { bookLimit: Number(values.bookLimit) }),
    ...(values.editorLimit !== initial.editorLimit && {
      editorLimit: Number(values.editorLimit),
    }),
    ...(description !== initial.description && { description }),
  };
  const hasChanges = Object.keys(changes).length > 0;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validate(values, isFree);

    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    const note = values.note.trim();
    const durationMonths = Number(values.durationMonths);

    setIsPending(true);
    setErrors({});

    try {
      if (isEdit) {
        await api(`/admin/plans/${plan.id}`, {
          method: "PATCH",
          auth: true,
          body: { ...changes, note },
        });
        onSaved(`Đã lưu gói ${planTitle({ ...plan, name })}`);
      } else {
        await api("/admin/plans", {
          method: "POST",
          auth: true,
          body: {
            name,
            durationMonths,
            price: Number(values.price),
            bookLimit: Number(values.bookLimit),
            editorLimit: Number(values.editorLimit),
            ...(description && { description }),
            note,
          },
        });
        onSaved(`Đã thêm gói ${name} (${durationMonths} tháng)`);
      }
    } catch (error) {
      // Lỗi hệ thống đã có toast (api.ts)
      if (!(error instanceof ApiError) || isSystemError(error.status)) {
        return;
      }

      if (isEdit && error.status === NOT_FOUND_STATUS) {
        onGone();
      } else if (error.code === PLAN_ERROR_CODES.PLAN_ALREADY_EXISTS) {
        const months = plan?.durationMonths ?? durationMonths;
        setErrors({ name: `Gói ${name} ${months} tháng đã tồn tại` });
      } else {
        setErrors({ form: error.message });
      }
    } finally {
      setIsPending(false);
    }
  };

  const notePlaceholder = !isEdit
    ? "VD: Mở bán gói mới theo kế hoạch quý 1"
    : isFree
      ? "VD: Cho phép nhà xuất bản miễn phí đăng thử 5 cuốn"
      : "VD: Tăng hạn mức biên tập viên theo phản hồi";

  return (
    <AppDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={isEdit ? `Sửa gói ${planTitle(plan)}` : "Thêm gói"}
      description="Tên gói chỉ gồm chữ cái không dấu, chữ số và dấu cách."
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        <BoxedInput
          id="plan-name"
          label="Tên gói"
          placeholder="VD: Basic"
          maxLength={PLAN_NAME_MAX_LENGTH}
          autoComplete="off"
          value={values.name}
          onChange={set("name")}
          error={errors.name}
        />
        <div className="grid gap-6 sm:grid-cols-2 sm:gap-4">
          {isEdit ? (
            <BoxedInput
              id="plan-duration"
              label="Thời hạn"
              value={durationLabel(plan)}
              disabled
            />
          ) : (
            <BoxedSelect
              id="plan-duration"
              label="Thời hạn"
              value={values.durationMonths}
              onChange={set("durationMonths")}
            >
              {PLAN_DURATION_MONTHS.map((months) => (
                <option key={months} value={months}>
                  {months} tháng
                </option>
              ))}
            </BoxedSelect>
          )}
          <BoxedInput
            id="plan-price"
            label="Giá (đồng)"
            placeholder="VD: 500000"
            inputMode="numeric"
            autoComplete="off"
            value={isFree ? formatPrice(0) : values.price}
            onChange={set("price", true)}
            disabled={isFree}
            error={errors.price}
          />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 sm:gap-4">
          <BoxedInput
            id="plan-book-limit"
            label="Số sách tối đa"
            placeholder="VD: 100000"
            inputMode="numeric"
            autoComplete="off"
            value={values.bookLimit}
            onChange={set("bookLimit", true)}
            error={errors.bookLimit}
          />
          <BoxedInput
            id="plan-editor-limit"
            label="Số biên tập viên tối đa"
            placeholder="VD: 2"
            inputMode="numeric"
            autoComplete="off"
            value={values.editorLimit}
            onChange={set("editorLimit", true)}
            error={errors.editorLimit}
          />
        </div>
        <BoxedTextarea
          id="plan-description"
          label="Mô tả"
          placeholder="Không bắt buộc"
          rows={2}
          maxLength={PLAN_DESCRIPTION_MAX_LENGTH}
          value={values.description}
          onChange={set("description")}
        />
        <BoxedTextarea
          id="plan-note"
          label="Ghi chú"
          placeholder={notePlaceholder}
          rows={2}
          maxLength={NOTE_MAX_LENGTH}
          value={values.note}
          onChange={set("note")}
          error={errors.note}
        />
        {isEdit && (
          <p className="rounded-xl bg-primary/10 px-4 py-3 text-base/[1.4] font-semibold text-[#0078c8]">
            {isFree
              ? "Đổi hạn mức sẽ gửi email cho các nhà xuất bản đang ở gói Free."
              : "Đổi giá hoặc hạn mức sẽ gửi email cho các nhà xuất bản đang dùng gói này. Họ giữ hạn mức cũ đến hết kỳ."}
          </p>
        )}
        {errors.form && <FormMessage tone="error">{errors.form}</FormMessage>}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            className={actionButton("secondary")}
            onClick={onClose}
          >
            Hủy
          </Button>
          <Button
            type="submit"
            disabled={isPending || (isEdit && !hasChanges)}
            className={actionButton("primary")}
          >
            {isEdit ? "Lưu" : "Thêm gói"}
          </Button>
        </div>
      </form>
    </AppDialog>
  );
}
