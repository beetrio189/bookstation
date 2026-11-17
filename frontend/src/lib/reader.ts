import { api } from "@/lib/api";
import { normalizeName } from "@/lib/moderators";
import {
  MOCK_BOOKS,
  MOCK_PUBLISHERS,
} from "@/lib/reader-mock";

// Dữ liệu cho khu độc giả. Backend bỏ trường null nên trường có thể thiếu là tùy chọn.

export interface BookSummary {
  id: string;
  slug: string;
  title: string;
  // Tên tác giả lấy từ books.contributors
  authors: string[];
  coverUrl?: string;
  // Chưa ai đánh giá thì không có
  ratingAvg?: number;
  ratingCount: number;
}

export interface PublisherSummary {
  id: string;
  slug: string;
  publisherName: string;
  logoUrl?: string;
}

export interface SurveySummary {
  id: string;
  title: string;
  description?: string;
  endsAt: string;
  publisher: PublisherSummary;
}

export interface Genre {
  id: string;
  slug: string;
  name: string;
}

export interface SearchResult {
  books: BookSummary[];
  publishers: PublisherSummary[];
}

const SEARCH_BOOK_LIMIT = 5;
const SEARCH_PUBLISHER_LIMIT = 3;

// Tìm trong dữ liệu mock khi chưa gọi được API: không dấu, không phân biệt hoa thường
function searchMock(keyword: string): SearchResult {
  const q = normalizeName(keyword);

  return {
    books: MOCK_BOOKS.filter((book) =>
      normalizeName(book.title).includes(q),
    ).slice(0, SEARCH_BOOK_LIMIT),
    publishers: MOCK_PUBLISHERS.filter((publisher) =>
      normalizeName(publisher.publisherName).includes(q),
    ).slice(0, SEARCH_PUBLISHER_LIMIT),
  };
}

/**
 * Tìm sách và nhà xuất bản (không tìm theo tác giả). Gọi GET /api/reader/search;
 * API chưa có hoặc lỗi thì dùng dữ liệu mock, không hiện toast.
 */
export async function searchCatalog(keyword: string): Promise<SearchResult> {
  try {
    const result = await api<Partial<SearchResult>>(
      `/reader/search?q=${encodeURIComponent(keyword)}`,
      { silent: true },
    );

    return { books: result.books ?? [], publishers: result.publishers ?? [] };
  } catch {
    return searchMock(keyword);
  }
}

// Số ngày còn lại của khảo sát, làm tròn lên ("Còn 1 ngày" khi chỉ còn vài giờ)
export const daysLeft = (endsAt: string) =>
  Math.max(0, Math.ceil((Date.parse(endsAt) - Date.now()) / 86_400_000));
