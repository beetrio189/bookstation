// Khớp response /api/admin/genres
export interface AdminGenreItem {
  id: string;
  name: string;
  slug: string;
  bookCount: number;
  createdAt: string;
}

export interface AdminGenrePage {
  items: AdminGenreItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Khớp backend/src/modules/genres/dto/genre-fields.dto.ts
export const GENRE_NAME_MAX_LENGTH = 100;

// Mã lỗi backend (backend/src/utils/errors/errors.ts)
export const GENRE_ERROR_CODES = {
  GENRE_ALREADY_EXISTS: 3008,
} as const;

// Giống @NormalizeText() backend: NFC, ký tự điều khiển → dấu cách, bỏ ký tự ẩn, gộp khoảng trắng
export const normalizeGenreName = (value: string) =>
  value
    .normalize("NFC")
    .replace(/\p{Cc}/gu, " ")
    .replace(/\p{Cf}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
