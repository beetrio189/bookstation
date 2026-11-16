import { toast } from "sonner";
import { getAccessToken, setAccessToken } from "@/lib/auth-token";
import { API_URL } from "@/lib/config";

// Khớp mã lỗi backend (backend/src/utils/errors/errors.ts)
const UNAUTHENTICATED_CODE = 1001;
const INTERNAL_ERROR_CODE = 1005;
const NETWORK_ERROR_CODE = 0;

const NETWORK_ERROR_MESSAGE =
  "Không kết nối được máy chủ, vui lòng kiểm tra mạng và thử lại";
const INTERNAL_ERROR_MESSAGE = "Đã có lỗi xảy ra, vui lòng thử lại sau";

// Mọi lỗi hệ thống dùng chung một id: lỗi dồn dập chỉ hiện một toast
const SYSTEM_ERROR_TOAST_ID = "system-error";

export class ApiError extends Error {
  constructor(
    // 0 khi không gọi được tới server (mất mạng, server tắt, CORS)
    readonly status: number,
    readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  // Gắn access token đang có; gặp 401 thì refresh một lần rồi gọi lại
  auth?: boolean;
  // Không hiện toast lỗi hệ thống (gọi ngầm, người dùng không bấm gì)
  silent?: boolean;
}

interface ErrorBody {
  error?: { code?: unknown; message?: unknown };
}

// 429, 5xx, mất mạng: lỗi hệ thống, màn không tự xử lý được nên báo bằng toast
export const isSystemError = (status: number) =>
  status === NETWORK_ERROR_CODE || status === 429 || status >= 500;

const readError = async (response: Response) => {
  const body = (await response.json().catch(() => null)) as ErrorBody | null;
  const { code, message } = body?.error ?? {};

  return {
    code: typeof code === "number" ? code : INTERNAL_ERROR_CODE,
    message: typeof message === "string" ? message : INTERNAL_ERROR_MESSAGE,
  };
};

const fail = (
  status: number,
  code: number,
  message: string,
  silent = false,
): never => {
  if (isSystemError(status) && !silent) {
    toast.error(message, { id: SYSTEM_ERROR_TOAST_ID });
  }

  throw new ApiError(status, code, message);
};

async function request<T>(
  path: string,
  { method = "GET", body, auth = false, silent = false }: ApiOptions,
): Promise<T> {
  const accessToken = auth ? getAccessToken() : null;
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      // Gửi kèm cookie refresh token (httpOnly) cho các route /auth
      credentials: "include",
      headers: {
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return fail(
      NETWORK_ERROR_CODE,
      NETWORK_ERROR_CODE,
      NETWORK_ERROR_MESSAGE,
      silent,
    );
  }

  if (!response.ok) {
    const { code, message } = await readError(response);

    return fail(response.status, code, message, silent);
  }

  const json = (await response.json().catch(() => null)) as {
    data?: T;
  } | null;

  return (json?.data ?? {}) as T;
}

let refreshing: Promise<boolean> | null = null;

/**
 * Lấy access token mới bằng cookie refresh token (sau F5, sau đăng nhập Google,
 * khi access token hết hạn). Nhiều chỗ gọi cùng lúc thì dùng chung một request.
 * Trả false nếu chưa đăng nhập / phiên hết hạn / tài khoản bị khóa.
 */
export function refreshSession(): Promise<boolean> {
  refreshing ??= request<{ accessToken: string }>("/auth/refresh", {
    method: "POST",
    silent: true,
  })
    .then(({ accessToken }) => {
      setAccessToken(accessToken);
      return true;
    })
    .catch(() => {
      setAccessToken(null);
      return false;
    })
    .finally(() => {
      refreshing = null;
    });

  return refreshing;
}

/**
 * Gọi API backend, trả về phần `data` của response.
 * - Lỗi hệ thống (429, 5xx, mất mạng): tự hiện toast góc phải rồi ném ApiError.
 * - Lỗi nghiệp vụ (4xx khác): chỉ ném ApiError, màn tự hiện lỗi theo `code`.
 * - `auth: true`: chưa có token hoặc token hết hạn (401) thì refresh rồi gọi lại một lần.
 */
export async function api<T = Record<string, never>>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  if (options.auth && !getAccessToken()) {
    await refreshSession();
  }

  try {
    return await request<T>(path, options);
  } catch (error) {
    const isExpired =
      options.auth &&
      error instanceof ApiError &&
      error.code === UNAUTHENTICATED_CODE &&
      (await refreshSession());

    if (!isExpired) {
      throw error;
    }

    return request<T>(path, options);
  }
}
