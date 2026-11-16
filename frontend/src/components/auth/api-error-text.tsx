import Link from "next/link";

// Khớp ERRORS.EMAIL_ALREADY_VERIFIED của backend
const EMAIL_ALREADY_VERIFIED = 2010;

/**
 * Câu lỗi nghiệp vụ hiện dưới form. Phần lớn dùng nguyên message của BE;
 * vài mã cần gắn link thì FE tự dựng câu (BE không gửi được link trong message).
 */
export function ApiErrorText({ code, text }: { code: number; text: string }) {
  if (code === EMAIL_ALREADY_VERIFIED) {
    return (
      <>
        Email này đã được xác minh. Nếu quên mật khẩu, hãy chuyển qua{" "}
        <Link
          href="/forgot-password"
          className="font-bold text-primary underline"
        >
          Quên mật khẩu
        </Link>
        .
      </>
    );
  }

  return text;
}
