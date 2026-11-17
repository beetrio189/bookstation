import { useEffect, useRef, useState } from "react";
import { AuthResult } from "@/components/auth/auth-result";
import { Button } from "@/components/ui/button";
import { api, ApiError, isSystemError } from "@/lib/api";

type Status = "verifying" | "verified" | "invalid" | "failed";

// 3 trạng thái đầu theo 3 frame Figma "Xác thực email (...)"
export function VerifyingEmail() {
  return (
    <AuthResult title="Đang xác thực email...">
      Vui lòng chờ trong giây lát, chúng tôi đang xác thực email của bạn.
    </AuthResult>
  );
}

// uid, token lấy từ link trong email: /verify-email?uid=...&token=...
export function VerifyEmailStatus({
  uid,
  token,
}: {
  uid?: string;
  token?: string;
}) {
  const [status, setStatus] = useState<Status>(
    uid && token ? "verifying" : "invalid",
  );
  // Token chỉ dùng được một lần: chặn gọi lần hai khi React chạy effect hai lần (dev)
  const startedFor = useRef<string | null>(null);

  const verify = async (uid: string, token: string) => {
    try {
      await api("/auth/verify-email", { method: "POST", body: { uid, token } });
      setStatus("verified");
    } catch (caught) {
      // Lỗi hệ thống đã có toast; lỗi nghiệp vụ (token sai/hết hạn, uid sai) là link hỏng
      setStatus(
        caught instanceof ApiError && !isSystemError(caught.status)
          ? "invalid"
          : "failed",
      );
    }
  };

  useEffect(() => {
    const key = `${uid}:${token}`;

    if (!uid || !token || startedFor.current === key) {
      return;
    }

    startedFor.current = key;
    void verify(uid, token);
  }, [uid, token]);

  if (status === "verifying") {
    return <VerifyingEmail />;
  }

  if (status === "verified") {
    return (
      <AuthResult
        title="Xác thực thành công!"
        action={{ to: "/login", label: "Đăng nhập" }}
      >
        Email của bạn đã được xác thực. Bây giờ bạn có thể đăng nhập vào
        BookStation.
      </AuthResult>
    );
  }

  if (status === "invalid") {
    return (
      <AuthResult
        title="Liên kết không hợp lệ"
        action={{
          to: "/resend-verification",
          label: "Gửi lại email xác thực",
        }}
      >
        Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu gửi lại email xác
        thực để nhận liên kết mới.
      </AuthResult>
    );
  }

  // Server quá tải / mất mạng: link có thể vẫn còn tốt nên cho thử lại (không có frame Figma)
  return (
    <div className="flex w-full max-w-100 flex-col gap-5 leading-tight">
      <AuthResult title="Chưa xác thực được">
        Máy chủ đang bận hoặc mất kết nối. Liên kết của bạn vẫn có thể dùng
        được, hãy thử lại sau ít phút.
      </AuthResult>
      <Button
        type="button"
        onClick={() => {
          if (uid && token) {
            setStatus("verifying");
            void verify(uid, token);
          }
        }}
        className="h-12.5 rounded-lg text-xl font-bold"
      >
        Thử lại
      </Button>
    </div>
  );
}
