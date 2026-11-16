"use client";

import { useEffect } from "react";
import { refreshSession } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";

// Access token chỉ nằm trong bộ nhớ nên mất sau F5: mở web là lấy lại ngầm bằng
// cookie refresh token. Chưa đăng nhập thì /auth/refresh trả 401, bỏ qua.
export function SessionRestorer() {
  useEffect(() => {
    if (!getAccessToken()) {
      void refreshSession();
    }
  }, []);

  return null;
}
