import { createFileRoute } from "@tanstack/react-router";
import { searchString } from "@/lib/search";
import { PublishersList } from "./-publishers-list";

export interface PublishersSearch {
  page?: number;
  q?: string;
}

// Trang và từ khóa nằm trên URL: bấm Quay lại từ chi tiết vẫn về đúng trang đang xem
export const Route = createFileRoute("/admin/publishers/")({
  validateSearch: (search: Record<string, unknown>): PublishersSearch => {
    const page = Number(search.page);

    return {
      page: Number.isInteger(page) && page > 1 ? page : undefined,
      q: searchString(search.q)?.slice(0, 100),
    };
  },
  head: () => ({ meta: [{ title: "Nhà xuất bản | BookStation" }] }),
  component: PublishersList,
});
