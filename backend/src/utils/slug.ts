const MAX_SLUG_LENGTH = 200;

/**
 * "Nhà xuất bản Kim Đồng" → "nha-xuat-ban-kim-dong". Không còn chữ/số nào
 * (tên toàn ký hiệu) thì dùng fallback.
 */
export const slugify = (value: string, fallback: string): string => {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, '');

  return slug || fallback;
};

/**
 * Slug chưa dùng: base, base-2, base-3... `taken` là các slug đang có dạng
 * base hoặc base-<số>.
 */
export const nextFreeSlug = (base: string, taken: string[]): string => {
  const used = new Set(taken);

  if (!used.has(base)) {
    return base;
  }

  let suffix = 2;

  while (used.has(`${base}-${suffix}`)) {
    suffix++;
  }

  return `${base}-${suffix}`;
};
