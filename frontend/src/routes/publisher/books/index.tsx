import { createFileRoute } from "@tanstack/react-router";
import { UNCATEGORIZED } from "@/lib/books";
import { searchString } from "@/lib/search";
import { BooksList } from "./-books-list";

export interface BooksSearch {
  page?: number;
  q?: string;
  // id thể loại ngăn phẩy (lọc AND) hoặc "none"
  genres?: string;
}

const GENRE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Giữ id hợp lệ, không trùng, tối đa 10; "none" chỉ đứng một mình
const readGenres = (value: unknown) => {
  const ids = [
    ...new Set(
      (searchString(value) ?? "")
        .split(",")
        .map((id) => id.trim().toLowerCase()),
    ),
  ];

  if (ids.includes(UNCATEGORIZED)) {
    return UNCATEGORIZED;
  }

  const valid = ids.filter((id) => GENRE_ID.test(id)).slice(0, 10);

  return valid.length > 0 ? valid.join(",") : undefined;
};

// NXB và biên tập viên; trang, từ khóa, thể loại nằm trên URL
export const Route = createFileRoute("/publisher/books/")({
  validateSearch: (search: Record<string, unknown>): BooksSearch => {
    const page = Number(search.page);

    return {
      page: Number.isInteger(page) && page > 1 ? page : undefined,
      q: searchString(search.q)?.slice(0, 100),
      genres: readGenres(search.genres),
    };
  },
  head: () => ({ meta: [{ title: "Sách | BookStation" }] }),
  component: BooksList,
});
