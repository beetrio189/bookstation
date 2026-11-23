import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  CheckIcon,
  CircleAlertIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import { AccountMenu } from "@/components/account-menu";
import { actionButton } from "@/components/app-dialog";
import { Button } from "@/components/ui/button";
import type { PaymentResult } from "@/lib/payments";
import { getRole, guardArea } from "@/lib/session";
import { cn } from "@/lib/utils";

const RESULTS: Record<
  PaymentResult,
  { icon: LucideIcon; color: string; title: string; message: string }
> = {
  success: {
    icon: CheckIcon,
    color: "text-[#16a34a] bg-[#16a34a]/12",
    title: "Thanh toán thành công",
    message:
      "Đã nhận thanh toán, gói sẽ được kích hoạt trong giây lát. Chúng tôi cũng đã gửi email biên nhận cho bạn.",
  },
  cancel: {
    icon: XIcon,
    color: "text-[#737380] bg-[#737380]/12",
    title: "Bạn đã hủy thanh toán",
    message: "Nếu muốn thanh toán lại, hãy quay về trang Gói hội viên.",
  },
  error: {
    icon: CircleAlertIcon,
    color: "text-[#dc2626] bg-[#dc2626]/12",
    title: "Thanh toán không thành công",
    message:
      "Đã có lỗi trong quá trình thanh toán. Hãy quay về trang Gói hội viên để thử lại.",
  },
};

// "publisher_": giữ đường dẫn /publisher/payments/:id (URL backend gửi SePay) nhưng
// không lồng trong khung có sidebar của khu NXB, nên tự kiểm tra quyền vào khu
export const Route = createFileRoute("/publisher_/payments/$id")({
  // SePay chuyển về kèm ?result=success|cancel|error (URL do backend đặt khi tạo form)
  validateSearch: (
    search: Record<string, unknown>,
  ): { result: PaymentResult } => ({
    result:
      search.result === "success" || search.result === "cancel"
        ? search.result
        : "error",
  }),
  beforeLoad: async () => {
    await guardArea("publisher");

    if (getRole() === "editor") {
      throw redirect({ to: "/publisher" });
    }
  },
  head: () => ({ meta: [{ title: "Kết quả thanh toán | BookStation" }] }),
  component: PaymentResultPage,
});

/**
 * Theo Figma "NXB / Thanh toán / Thành công | Đã hủy | Lỗi": không sidebar, ô thông
 * báo ở giữa màn hình. Trang tĩnh theo ?result=, không gọi API.
 */
function PaymentResultPage() {
  const { result } = Route.useSearch();
  const { icon: Icon, color, title, message } = RESULTS[result];

  return (
    <div className="flex min-h-screen flex-col bg-cream px-4 pt-4 pb-10 md:px-10 lg:pt-7.5 2xl:px-20">
      <header className="flex justify-end">
        <AccountMenu />
      </header>
      <main className="flex flex-1 items-center justify-center py-10">
        <div className="flex w-[560px] max-w-full flex-col items-center gap-4 rounded-[20px] bg-white px-6 py-12 text-center sm:px-10">
          <div
            className={cn(
              "flex size-20 items-center justify-center rounded-full",
              color,
            )}
          >
            <Icon className="size-10" strokeWidth={2} />
          </div>
          <h1 className="text-[22px] font-bold sm:text-[26px]">{title}</h1>
          <p className="text-[17px]/[1.3] font-medium text-foreground/75">
            {message}
          </p>
          <Button asChild className={cn(actionButton("primary"), "mt-2")}>
            <Link to="/publisher/plans">Về trang gói</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
