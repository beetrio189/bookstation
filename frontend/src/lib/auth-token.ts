// Access token lưu trong localStorage để mở lại trang là biết ngay đang đăng nhập
// với role gì. Token chỉ sống 15 phút; refresh token vẫn là cookie httpOnly.
const STORAGE_KEY = "bookstation.accessToken";

// localStorage có thể bị chặn (chế độ riêng tư, chặn dữ liệu trang web): coi như chưa đăng nhập
export const getAccessToken = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

export const setAccessToken = (token: string | null) => {
  try {
    if (token) {
      localStorage.setItem(STORAGE_KEY, token);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Không lưu được thì lần sau mở trang sẽ refresh lại bằng cookie
  }
};
