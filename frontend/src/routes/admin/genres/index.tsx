import { createFileRoute } from "@tanstack/react-router";
import { searchString } from "@/lib/search";
import { GenresList } from "./-genres-list";

export interface GenresSearch {
  page?: number;
  q?: string;
}

// Admin và KDV đều quản lý thể loại; trang và từ khóa nằm trên URL
export const Route = createFileRoute("/admin/genres/")({
  validateSearch: (search: Record<string, unknown>): GenresSearch => {
    const page = Number(search.page);

    return {
      page: Number.isInteger(page) && page > 1 ? page : undefined,
      q: searchString(search.q)?.slice(0, 100),
    };
  },
  head: () => ({ meta: [{ title: "Thể loại | BookStation" }] }),
  component: GenresList,
});
