import { api } from "@/lib/api";

export type ContributorRole = "author" | "translator" | "editor" | "illustrator";

export interface Contributor {
  name: string;
  role: ContributorRole;
}

export interface GenreRef {
  id: string;
  name: string;
}

// Khớp GET /api/publisher/books (backend bỏ trường null)
export interface PublisherBookItem {
  id: string;
  title: string;
  slug: string;
  coverPublicId?: string;
  contributors: Contributor[];
  genres: GenreRef[];
  ratingAvg?: number;
  ratingCount: number;
  createdAt: string;
}

export interface PublisherBookPage {
  items: PublisherBookItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Khớp GET /api/publisher/books/:id
export interface PublisherBookDetail extends PublisherBookItem {
  description?: string;
  publishedYear?: number;
  updatedAt: string;
}

// Khớp POST /api/publisher/books/cover-upload
interface CoverUploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  publicId: string;
  allowedFormats: string;
  transformation: string;
}

// Khớp backend/src/modules/publishers/dto/book-fields.ts
export const BOOK_TITLE_MAX_LENGTH = 500;
export const BOOK_DESCRIPTION_MAX_LENGTH = 5000;
export const CONTRIBUTOR_NAME_MAX_LENGTH = 200;
export const CONTRIBUTORS_MAX = 20;
export const BOOK_GENRES_MAX = 10;
export const NOTE_MAX_LENGTH = 1000;
// Giá trị lọc "Chưa phân loại" của GET /publisher/books?genres=
export const UNCATEGORIZED = "none";

export const CONTRIBUTOR_ROLES: { value: ContributorRole; label: string }[] = [
  { value: "author", label: "Tác giả" },
  { value: "translator", label: "Dịch giả" },
  { value: "editor", label: "Biên tập" },
  { value: "illustrator", label: "Minh họa" },
];

// Hậu tố sau tên người không phải tác giả: "Lê Chu Cầu (dịch)"
const ROLE_SUFFIX: Record<ContributorRole, string> = {
  author: "",
  translator: " (dịch)",
  editor: " (biên tập)",
  illustrator: " (minh họa)",
};

// Tác giả trước, người đóng góp khác sau, ngăn bằng " · "
export const contributorLine = (contributors: Contributor[]) =>
  [
    ...contributors.filter((c) => c.role === "author"),
    ...contributors.filter((c) => c.role !== "author"),
  ]
    .map((c) => c.name + ROLE_SUFFIX[c.role])
    .join(" · ");

// Mã lỗi backend (backend/src/utils/errors/errors.ts)
export const BOOK_ERROR_CODES = {
  NOTHING_TO_UPDATE: 1007,
  BOOK_LIMIT_REACHED: 5000,
  GENRE_NOT_FOUND: 5001,
  INVALID_COVER: 5002,
} as const;

// Named transformation trên Cloudinary (strict: chỉ dùng được các cỡ này)
const COVER_SIZES = {
  thumb: "t_cover_thumb", // 80×120, bìa 40×60 trong bảng
  card: "t_cover_card", // 400×600
  detail: "t_cover_detail", // 600×900
} as const;

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as
  | string
  | undefined;

export const coverUrl = (
  publicId: string | undefined,
  size: keyof typeof COVER_SIZES,
) =>
  publicId && CLOUD_NAME
    ? `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${COVER_SIZES[size]}/${publicId}`
    : undefined;

export class CoverUploadError extends Error {}

/**
 * Xin chữ ký ở BE rồi upload thẳng file lên Cloudinary; trả public_id để gửi kèm khi lưu sách.
 * Lỗi lấy chữ ký (429, mất mạng…) là ApiError, api() đã hiện toast;
 * Cloudinary từ chối (quá 10 MB, không phải ảnh, sai định dạng) là CoverUploadError.
 */
export async function uploadCover(file: File): Promise<string> {
  const sig = await api<CoverUploadSignature>("/publisher/books/cover-upload", {
    method: "POST",
    auth: true,
  });
  const form = new FormData();

  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("signature", sig.signature);
  form.append("public_id", sig.publicId);
  form.append("allowed_formats", sig.allowedFormats);
  form.append("transformation", sig.transformation);

  let response: Response;

  try {
    response = await fetch(
      `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
      { method: "POST", body: form },
    );
  } catch {
    throw new CoverUploadError(
      "Không tải được ảnh lên, vui lòng kiểm tra mạng và thử lại",
    );
  }

  if (!response.ok) {
    throw new CoverUploadError(
      "Ảnh không hợp lệ hoặc quá 10 MB, hãy chọn ảnh khác",
    );
  }

  return sig.publicId;
}
