import { ImageIcon, LoaderCircle, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { CoverUploadError, coverUrl, uploadCover } from "@/lib/books";
import { cn } from "@/lib/utils";

const SMALL_BUTTON =
  "flex h-10 items-center gap-2 rounded-[10px] border-2 px-4 text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Ô ảnh bìa (component Figma "Ô ảnh bìa": Trống / Đang xử lý / Có ảnh / Lỗi).
 * Chọn file là upload ngay lên Cloudinary, suốt lúc chờ chỉ ghi "Đang xử lý…" (không %).
 * value: public_id đang dùng (null = không có bìa).
 */
export function CoverField({
  value,
  onChange,
  onBusyChange,
  error,
}: {
  value: string | null;
  onChange: (publicId: string | null) => void;
  onBusyChange: (busy: boolean) => void;
  // Lỗi từ BE khi lưu (vé ảnh hết hạn…)
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  // Ảnh vừa chọn xem ngay bằng file trên máy, khỏi chờ CDN
  const [preview, setPreview] = useState<{ publicId: string; url: string }>();

  useEffect(() => () => preview && URL.revokeObjectURL(preview.url), [preview]);

  const pick = async (file: File) => {
    setIsUploading(true);
    onBusyChange(true);
    setUploadError(undefined);

    try {
      const publicId = await uploadCover(file);

      setPreview({ publicId, url: URL.createObjectURL(file) });
      onChange(publicId);
    } catch (cause) {
      if (cause instanceof CoverUploadError) {
        setUploadError(cause.message);
      } else if (!(cause instanceof ApiError)) {
        throw cause;
      }
      // ApiError (429, mất mạng…): api() đã hiện toast
    } finally {
      setIsUploading(false);
      onBusyChange(false);
    }
  };

  const src =
    value && preview?.publicId === value
      ? preview.url
      : coverUrl(value ?? undefined, "detail");
  const shownError = uploadError ?? error;

  return (
    <div className="flex flex-col gap-4 rounded-[20px] bg-white p-6 sm:p-8 lg:w-74 lg:shrink-0 lg:self-start">
      <div>
        <p className="text-lg/[1.3] font-bold">Ảnh bìa</p>
        <p className="text-[15px] font-medium text-foreground/55">
          Không bắt buộc
        </p>
      </div>

      <div
        className={cn(
          "flex aspect-[2/3] w-full max-w-58 items-center justify-center overflow-hidden rounded-[10px] bg-[#e2dccb]",
          !src || isUploading
            ? "border-2 border-dashed border-foreground/25"
            : "",
          shownError && !isUploading && "border-solid border-[#ff6d6d]",
        )}
      >
        {isUploading ? (
          <span className="flex flex-col items-center gap-3 text-base font-semibold">
            <LoaderCircle className="size-7 animate-spin text-primary" />
            Đang xử lý…
          </span>
        ) : src && !shownError ? (
          <img src={src} alt="Ảnh bìa" className="size-full object-cover" />
        ) : (
          !shownError && (
            <span className="flex flex-col items-center gap-3 text-base font-medium text-foreground/55">
              <ImageIcon className="size-8" strokeWidth={1.5} />
              Chưa có ảnh bìa
            </span>
          )
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) {
            void pick(file);
          }
        }}
      />

      <div className="flex gap-2.5">
        {value && !shownError ? (
          <>
            <button
              type="button"
              disabled={isUploading}
              onClick={() => inputRef.current?.click()}
              className={cn(SMALL_BUTTON, "border-foreground hover:bg-foreground/5")}
            >
              Đổi ảnh
            </button>
            <button
              type="button"
              disabled={isUploading}
              onClick={() => onChange(null)}
              className={cn(
                SMALL_BUTTON,
                "border-[#ff6d6d] text-[#ff6d6d] hover:bg-[#ff6d6d]/8",
              )}
            >
              Gỡ ảnh
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
            className={cn(SMALL_BUTTON, "border-foreground hover:bg-foreground/5")}
          >
            <Upload className="size-4.5" strokeWidth={2.5} />
            Tải ảnh lên
          </button>
        )}
      </div>

      <p
        role={shownError ? "alert" : undefined}
        className={cn(
          "text-sm font-semibold",
          shownError ? "text-[#ff6d6d]" : "text-foreground/55",
        )}
      >
        {shownError ?? "JPG, PNG hoặc WEBP · tối đa 10 MB"}
      </p>
    </div>
  );
}
