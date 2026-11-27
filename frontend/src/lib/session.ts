import { redirect } from "@tanstack/react-router";
import { api, refreshSession } from "@/lib/api";
import { getAccessToken, setAccessToken } from "@/lib/auth-token";

// Khớp RoleCode của backend
export type Role = "reader" | "publisher" | "editor" | "admin" | "moderator";

export type Area = "admin" | "publisher" | "reader";

// Mỗi role chỉ ở khu của mình
const AREA_OF: Record<Role, Area> = {
  admin: "admin",
  moderator: "admin",
  publisher: "publisher",
  editor: "publisher",
  reader: "reader",
};

const AREA_HOME = {
  admin: "/admin",
  publisher: "/publisher",
  reader: "/",
} as const satisfies Record<Area, string>;

export const areaOf = (role: Role): Area => AREA_OF[role];

export const homeOf = (role: Role | null) =>
  role ? AREA_HOME[AREA_OF[role]] : AREA_HOME.reader;

// Payload access token. Chỉ giải mã để biết hiện giao diện nào, không xác thực
// chữ ký: quyền thật do backend kiểm tra. Token hết hạn vẫn đọc được; gọi API sẽ tự refresh.
function readTokenPayload(): Record<string, unknown> | null {
  const token = getAccessToken();

  if (!token) {
    return null;
  }

  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");

    return JSON.parse(atob(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getRole(): Role | null {
  const role = readTokenPayload()?.role;

  return typeof role === "string" && role in AREA_OF ? (role as Role) : null;
}

// users.id của người đang đăng nhập (claim sub)
export function getUserId(): string | null {
  const sub = readTokenPayload()?.sub;

  return typeof sub === "string" ? sub : null;
}

/**
 * Tài khoản có đăng nhập bằng email + mật khẩu (provider "local") không. Tài khoản
 * chỉ đăng nhập Google thì không có mật khẩu để đổi, ẩn mục "Đổi mật khẩu".
 */
export function hasLocalLogin(): boolean {
  const providers = readTokenPayload()?.providers;

  return Array.isArray(providers) && providers.includes("local");
}

// Chưa có token (xóa dữ liệu trình duyệt...) thì thử refresh bằng cookie một lần
// mỗi lần mở app, khỏi gọi lại mỗi lần chuyển trang khi là khách
let hasTriedRefresh = false;

async function resolveRole(): Promise<Role | null> {
  if (!getAccessToken() && !hasTriedRefresh) {
    hasTriedRefresh = true;
    await refreshSession();
  }

  return getRole();
}

/**
 * Dùng trong `beforeLoad` của layout mỗi khu, chạy trước khi vẽ: sai khu thì về
 * trang chủ khu của mình; khu admin/publisher cần đăng nhập, chưa đăng nhập về /login.
 */
export async function guardArea(area: Area) {
  const role = await resolveRole();

  if (!role) {
    if (area !== "reader") {
      throw redirect({ to: "/login" });
    }

    return;
  }

  if (areaOf(role) !== area) {
    throw redirect({ to: homeOf(role) });
  }
}

// Thu hồi refresh token (cookie) rồi xóa access token
export async function logout() {
  try {
    await api("/auth/logout", { method: "POST" });
  } finally {
    setAccessToken(null);
  }
}
