import { Timer } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PublisherLogo } from "@/components/reader/publisher-logo";
import { daysLeft, type SurveySummary } from "@/lib/reader";
import { getRole } from "@/lib/session";

// Thẻ "Khảo sát đang mở": NXB, tiêu đề, mô tả, số ngày còn lại, nút Tham gia
export function SurveyCard({ survey }: { survey: SurveySummary }) {
  const navigate = useNavigate();
  const days = daysLeft(survey.endsAt);

  // Làm khảo sát cần đăng nhập; trang làm khảo sát chưa có
  const join = () => {
    if (!getRole()) {
      void navigate({ to: "/login" });
      return;
    }

    toast.info("Tính năng làm khảo sát đang được phát triển");
  };

  return (
    <article className="flex flex-col gap-2.5 rounded-2xl bg-white p-4.5 shadow-[0_4px_16px_rgba(0,0,0,0.06)] md:gap-4 md:p-7">
      <div className="flex items-center gap-3">
        <PublisherLogo publisher={survey.publisher} className="w-9 md:w-11" />
        <span className="truncate text-[15px] font-bold md:text-lg">
          {survey.publisher.publisherName}
        </span>
      </div>
      <h3 className="text-lg font-bold md:text-2xl">{survey.title}</h3>
      {survey.description && (
        <p className="line-clamp-2 text-sm font-medium text-foreground/60 md:text-[17px]">
          {survey.description}
        </p>
      )}
      <div className="mt-auto flex items-center justify-between gap-3 pt-1">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground/60 md:text-base">
          <Timer className="size-4" />
          {days > 0 ? `Còn ${days} ngày` : "Sắp kết thúc"}
        </span>
        <button
          type="button"
          onClick={join}
          className="rounded-[10px] bg-primary px-4 py-2 text-[15px] font-bold text-white hover:bg-primary-light md:px-6 md:py-3 md:text-lg"
        >
          Tham gia
        </button>
      </div>
    </article>
  );
}
