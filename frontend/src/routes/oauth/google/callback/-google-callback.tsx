import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthResult } from "@/components/auth/auth-result";
import { refreshSession } from "@/lib/api";
import { getRole, homeOf } from "@/lib/session";

// Backend chỉ gửi mã lỗi qua ?error=, câu chữ khớp ERRORS của backend
const ERROR_MESSAGES: Record<string, string> = {
  "2003": "Tài khoản của bạn đã bị khóa.",
  "2007": "Đăng nhập Google không thành công, vui lòng thử lại.",
};
const DEFAULT_ERROR_MESSAGE = "Đã có lỗi xảy ra, vui lòng thử lại sau.";

// Theo frame Figma "Đăng nhập Google (đang đăng nhập)"
export function GoogleSigningIn() {
  return (
    <AuthResult title="Đang đăng nhập...">
      Vui lòng chờ trong giây lát, chúng tôi đang hoàn tất đăng nhập bằng
      Google.
    </AuthResult>
  );
}

/**
 * Backend xử lý xong với Google thì chuyển về đây:
 * - thành công: đã đặt cookie refresh token, FE gọi /auth/refresh để lấy access token
 * - thất bại: ?error=<mã lỗi>
 */
export function GoogleCallback({ errorCode }: { errorCode?: string }) {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (errorCode) {
      return;
    }

    // refreshSession dùng chung một request nên React chạy effect hai lần (dev) cũng không sao
    void refreshSession().then((ok) => {
      if (ok) {
        void navigate({ to: homeOf(getRole()), replace: true });
      } else {
        setFailed(true);
      }
    });
  }, [errorCode, navigate]);

  if (!errorCode && !failed) {
    return <GoogleSigningIn />;
  }

  return (
    <AuthResult
      title="Đăng nhập không thành công"
      action={{ to: "/login", label: "Về trang đăng nhập" }}
    >
      {errorCode
        ? (ERROR_MESSAGES[errorCode] ?? DEFAULT_ERROR_MESSAGE)
        : DEFAULT_ERROR_MESSAGE}
    </AuthResult>
  );
}
