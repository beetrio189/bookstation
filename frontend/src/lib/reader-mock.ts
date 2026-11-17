import type {
  BookSummary,
  Genre,
  PublisherSummary,
  SurveySummary,
} from "@/lib/reader";

// Dữ liệu giả cho trang chủ khi backend chưa có API khu độc giả.
// Ảnh bìa lấy từ Figma "Trang chủ (mới)", nằm ở public/images/mock/covers.

const cover = (n: number) =>
  `/images/mock/covers/${String(n).padStart(2, "0")}.webp`;

const book = (
  n: number,
  slug: string,
  title: string,
  author: string,
  ratingAvg: number | undefined,
  ratingCount: number,
): BookSummary => ({
  id: `mock-book-${n}`,
  slug,
  title,
  authors: [author],
  coverUrl: cover(n),
  ...(ratingAvg !== undefined && { ratingAvg }),
  ratingCount,
});

export const MOCK_GENRES: Genre[] = [
  "Văn học",
  "Kinh tế",
  "Thiếu nhi",
  "Khoa học",
  "Lịch sử",
  "Tâm lý – Kỹ năng",
  "Ngoại văn",
  "Truyện tranh",
].map((name, i) => ({ id: `mock-genre-${i + 1}`, slug: `genre-${i + 1}`, name }));

const B = {
  cuaDo: book(1, "101-cach-cua-do-dai-lao-hang-xom", "101 cách cua đổ đại lão hàng xóm", "Đồng Vu", 4.9, 312),
  thieuSoai: book(2, "thieu-soai-chao-anh", "Thiếu soái, chào anh!", "Ngỗng Trời Xù Lông", 4.8, 120),
  kimPhan: book(3, "kim-phan", "Kim phấn", "Thanh Đồng Tuệ", 4.8, 98),
  daiLao: book(4, "song-lai-tro-thanh-dai-lao-gioi-khoa-hoc", "Sống lại trở thành đại lão giới khoa học", "Du Nhân", 4.7, 251),
  kySu: book(5, "lay-chang-ky-su", "Lấy chàng kỹ sư", "Đức Âm Bất Vong", 4.7, 64),
  xuyenNhanh: book(6, "xuyen-nhanh-cuu-roi-nam-phu", "Xuyên nhanh - Cứu rỗi nam phụ", "Cổn Kim", 4.6, 187),
  nhiepChinh: book(7, "nhiep-chinh-vuong-diet-dao-hoa", "Nhiếp chính vương diệt đào hoa", "Hoa Phỉ", 4.5, 76),
  tinhGiac: book(8, "tinh-giac-bong-tro-thanh-hung-thu-40-vu-an", "Tỉnh giấc bỗng trở thành hung thủ 40 vụ án", "Vô Hỉ", undefined, 0),
  acQuy: book(9, "ac-quy-khoac-ao-blouse", "Ác quỷ khoác áo blouse", "Lê Bảo Ngọc", 4.0, 3),
  khiAnh: book(10, "khi-anh-chay-ve-phia-em", "Khi anh chạy về phía em", "Trúc Dĩ", 5.0, 1),
  khoiNguon: book(11, "khoi-nguon-phuc-lac", "Khơi nguồn phúc lạc", "Vũ Pháp Như", undefined, 0),
  karamazov: book(12, "the-brothers-karamazov", "The Brothers Karamazov", "Fyodor Dostoevsky", 3.8, 5),
  sunAlsoRises: book(13, "the-sun-also-rises", "The Sun Also Rises", "Ernest Hemingway", 4.2, 9),
};

export const MOCK_BOOKS: BookSummary[] = Object.values(B);

export const MOCK_TOP_RATED: BookSummary[] = [
  B.cuaDo,
  B.thieuSoai,
  B.kimPhan,
  B.daiLao,
  B.kySu,
  B.xuyenNhanh,
  B.nhiepChinh,
];

export const MOCK_NEWEST: BookSummary[] = [
  B.tinhGiac,
  B.acQuy,
  B.khiAnh,
  B.khoiNguon,
  B.karamazov,
  B.sunAlsoRises,
  B.cuaDo,
];

// Chưa có logo: hiện chữ viết tắt trên nền màu (PublisherLogo)
export const MOCK_PUBLISHERS: PublisherSummary[] = [
  "Kim Đồng",
  "NXB Trẻ",
  "Nhã Nam",
  "Alpha Books",
  "Đinh Tị",
  "Thái Hà",
].map((publisherName, i) => ({
  id: `mock-publisher-${i + 1}`,
  slug: `publisher-${i + 1}`,
  publisherName,
}));

const inDays = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString();

export const MOCK_SURVEYS: SurveySummary[] = [
  {
    id: "mock-survey-1",
    title: "Bạn muốn đọc gì năm 2027?",
    description: "Giúp chúng tôi chọn đầu sách thiếu nhi cho năm tới.",
    endsAt: inDays(5),
    publisher: MOCK_PUBLISHERS[0],
  },
  {
    id: "mock-survey-2",
    title: "Bìa nào đẹp hơn?",
    description: "Chọn bìa cho ấn bản mới của bộ truyện dài kỳ.",
    endsAt: inDays(12),
    publisher: MOCK_PUBLISHERS[1],
  },
  {
    id: "mock-survey-3",
    title: "Thói quen đọc sách của bạn",
    description: "Mất khoảng 3 phút, 8 câu hỏi.",
    endsAt: inDays(20),
    publisher: MOCK_PUBLISHERS[2],
  },
];
