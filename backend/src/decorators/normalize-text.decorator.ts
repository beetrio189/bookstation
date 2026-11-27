import { Transform } from 'class-transformer';

/**
 * Chuẩn hóa văn bản một dòng: Unicode NFC (cùng một chữ luôn cùng chuỗi byte, unique
 * và tìm kiếm so đúng), xóa ký tự điều khiển + định dạng/zero-width (\p{Cc}\p{Cf}),
 * gộp khoảng trắng, trim. Không dùng cho trường nhiều dòng (sẽ mất xuống dòng).
 */
export const normalizeText = (value: string) =>
  value
    .normalize('NFC')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\p{Cf}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

export const NormalizeText = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeText(value) : value,
  );
