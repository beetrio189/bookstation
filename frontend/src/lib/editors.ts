// Khớp GET /api/publisher/editors (backend bỏ trường null): dòng đầu là chính NXB
export interface EditorListItem {
  id: string;
  name: string;
  // Không có khi tài khoản chỉ đăng nhập Google
  email?: string;
  role: "publisher" | "editor";
  // Chỉ có khi NXB gọi
  hasPassword?: boolean;
  createdAt: string;
}

// Khớp GET /api/publisher/editors/:id
export interface EditorDetail {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
}

// Mã lỗi backend (backend/src/utils/errors/errors.ts)
export const EDITOR_ERROR_CODES = {
  EMAIL_ALREADY_EXISTS: 2000,
  EDITOR_LIMIT_REACHED: 3009,
} as const;
