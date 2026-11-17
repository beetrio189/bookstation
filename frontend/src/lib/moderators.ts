import type { Role } from "@/lib/session";

// Khớp response /api/admin/moderators (backend bỏ trường null)
export interface ModeratorListItem {
  id: string;
  email: string;
  name: string;
  role: Extract<Role, "admin" | "moderator">;
  // Chỉ có khi admin gọi
  hasPassword?: boolean;
}

export interface ModeratorDetail extends Required<ModeratorListItem> {
  avatarUrl?: string;
  bio?: string;
  createdAt: string;
  updatedAt: string;
}

export const ROLE_LABELS: Record<ModeratorListItem["role"], string> = {
  admin: "Quản trị viên",
  moderator: "Kiểm duyệt viên",
};

// Bỏ dấu để lọc "binh" vẫn ra "Bình"
export const normalizeName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();

// "16/11/2026 10:24" theo giờ Việt Nam (toLocaleString vi-VN lại để giờ đứng trước)
export const formatDateTime = (value: string) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(value))
      .map(({ type, value: part }) => [type, part]),
  );

  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
};
