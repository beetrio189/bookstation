// Ảnh lưu trên Cloudinary: BE chỉ trả public_id, FE ghép URL với named transformation
// (Strict transformations đang bật: chỉ dùng được các tên đã tạo trên Cloudinary)
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as
  string | undefined;

const TRANSFORMATIONS = {
  coverThumb: "t_cover_thumb", // 80×120, bìa 40×60 trong bảng
  coverCard: "t_cover_card", // 400×600
  coverDetail: "t_cover_detail", // 600×900
  logoSmall: "t_logo_small", // 96×96, logo ≤ 48px
  logoLarge: "t_logo_large", // 320×320, logo 72–160px
} as const;

export const imageUrl = (
  publicId: string | undefined,
  size: keyof typeof TRANSFORMATIONS,
) =>
  publicId && CLOUD_NAME
    ? `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${TRANSFORMATIONS[size]}/${publicId}`
    : undefined;
