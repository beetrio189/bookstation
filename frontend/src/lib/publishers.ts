// Khớp response /api/admin/publishers và /api/admin/editors (backend bỏ trường null)

export type AccountStatus = "active" | "locked";

export type SubscriptionTier = "none" | "basic" | "advanced" | "pro";

export interface PublisherListItem {
  id: string;
  publisherName: string;
  status: AccountStatus;
  hasPassword: boolean;
}

export interface PublisherPage {
  items: PublisherListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PublisherDetail extends PublisherListItem {
  userId: string;
  email: string;
  logoUrl?: string;
  description?: string;
  subscriptionTier?: SubscriptionTier;
  bookCount: number;
  editorCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublisherEditorItem {
  id: string;
  name: string;
  email: string;
  status: AccountStatus;
  hasPassword: boolean;
  createdAt: string;
}

export interface EditorDetail extends PublisherEditorItem {
  userId: string;
  publisherId: string;
  publisherName: string;
  avatarUrl?: string;
  bio?: string;
  updatedAt: string;
}

export const TIER_LABELS: Record<SubscriptionTier, string> = {
  none: "Chưa đăng ký",
  basic: "Cơ bản",
  advanced: "Nâng cao",
  pro: "Pro",
};

// Mã lỗi backend (backend/src/utils/errors/errors.ts)
export const ERROR_CODES = {
  EMAIL_ALREADY_EXISTS: 2000,
  PUBLISHER_ALREADY_SUSPENDED: 3000,
  PUBLISHER_NOT_SUSPENDED: 3001,
  TARGET_ACCOUNT_LOCKED: 3002,
  PASSWORD_RESET_LIMIT: 3003,
} as const;
