CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE FUNCTION f_unaccent(text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT public.unaccent('public.unaccent', $1) $$;

COMMENT ON FUNCTION f_unaccent(text) IS 'Bản IMMUTABLE của unaccent(), dùng được trong cột generated và index.';

CREATE TYPE "user_status" AS ENUM (
  'active',
  'locked'
);

CREATE TYPE "role" AS ENUM (
  'reader',
  'publisher',
  'editor',
  'admin',
  'moderator'
);

CREATE TYPE "identity_provider" AS ENUM (
  'local',
  'google'
);

CREATE TYPE "payment_status" AS ENUM (
  'pending',
  'success',
  'failed'
);

CREATE TYPE "survey_status" AS ENUM (
  'active',
  'hidden'
);

CREATE TYPE "report_status" AS ENUM (
  'pending',
  'resolved',
  'dismissed'
);

CREATE TYPE "report_target_type" AS ENUM (
  'books',
  'book_reviews'
);

CREATE TYPE "system_action_type" AS ENUM (
  'moderator_creation',
  'moderator_deletion',
  'moderator_password_reset',
  'publisher_creation',
  'publisher_update',
  'publisher_deletion',
  'publisher_suspended',
  'publisher_unsuspended',
  'publisher_password_reset',
  'editor_creation',
  'editor_update',
  'editor_deletion',
  'editor_password_reset',
  'reader_lock',
  'reader_unlock',
  'book_creation',
  'book_update',
  'book_deletion',
  'book_review',
  'review_deletion',
  'plan_creation'
);

/* Bảng */

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT (uuidv7()),
  "role" role NOT NULL,
  "status" user_status NOT NULL DEFAULT 'active',
  "name" varchar(100) NOT NULL,
  "notification_email" varchar(255) NOT NULL,
  "notification_email_verified" bool NOT NULL,
  "avatar_url" text,
  "bio" text,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "refresh_tokens" (
  "id" uuid PRIMARY KEY DEFAULT (uuidv7()),
  "user_id" uuid NOT NULL,
  "token_hash" char(64) NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "providers" (
  "id" uuid PRIMARY KEY DEFAULT (uuidv7()),
  "user_id" uuid NOT NULL,
  "verified" bool,
  "provider" identity_provider NOT NULL,
  "provider_key" varchar(255) NOT NULL,
  "password_hash" varchar(255),
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "publishers" (
  "id" uuid PRIMARY KEY DEFAULT (uuidv7()),
  "user_id" uuid UNIQUE NOT NULL,
  "publisher_name" varchar(255) NOT NULL,
  "slug" varchar(255) UNIQUE NOT NULL,
  "logo_url" text,
  "description" text,
  "search_text" text NOT NULL GENERATED ALWAYS AS (f_unaccent(publisher_name)) STORED,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "editors" (
  "id" uuid PRIMARY KEY DEFAULT (uuidv7()),
  "user_id" uuid UNIQUE NOT NULL,
  "publisher_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "books" (
  "id" uuid PRIMARY KEY DEFAULT (uuidv7()),
  "publisher_id" uuid NOT NULL,
  "title" varchar(500) NOT NULL,
  "slug" varchar(255) UNIQUE NOT NULL,
  "description" text,
  "cover_url" text,
  "contributors" jsonb NOT NULL,
  "published_year" smallint,
  "rating_avg" numeric(3,2),
  "rating_count" integer NOT NULL DEFAULT 0 CHECK ("rating_count" >= 0),
  "search_text" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "genres" (
  "id" uuid PRIMARY KEY DEFAULT (uuidv7()),
  "name" varchar(100) UNIQUE NOT NULL,
  "slug" varchar(100) UNIQUE NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "book_genres" (
  "id" uuid PRIMARY KEY DEFAULT (uuidv7()),
  "book_id" uuid NOT NULL,
  "genre_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "book_reviews" (
  "id" uuid PRIMARY KEY DEFAULT (uuidv7()),
  "user_id" uuid NOT NULL,
  "book_id" uuid NOT NULL,
  "rating" smallint NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
  "comment" text,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "surveys" (
  "id" uuid PRIMARY KEY DEFAULT (uuidv7()),
  "publisher_id" uuid NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text,
  "starts_at" timestamptz NOT NULL,
  "ends_at" timestamptz NOT NULL,
  "survey_status" survey_status NOT NULL DEFAULT 'active',
  "survey_content" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  CHECK ("ends_at" > "starts_at")
);

CREATE TABLE "survey_answers" (
  "id" uuid PRIMARY KEY DEFAULT (uuidv7()),
  "user_id" uuid NOT NULL,
  "survey_id" uuid NOT NULL,
  "survey_answer_content" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "violation_reports" (
  "id" uuid PRIMARY KEY DEFAULT (uuidv7()),
  "reporter_id" uuid NOT NULL,
  "target_type" report_target_type NOT NULL,
  "target_id" uuid NOT NULL,
  "description" text,
  "status" report_status NOT NULL DEFAULT 'pending',
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "system_logs" (
  "id" uuid PRIMARY KEY DEFAULT (uuidv7()),
  "actor_id" uuid NOT NULL,
  "actor_name" text NOT NULL,
  "action_type" system_action_type NOT NULL,
  "target_id" uuid NOT NULL,
  "target_name" text NOT NULL,
  "note" text NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "plans" (
  "id" uuid PRIMARY KEY DEFAULT (uuidv7()),
  "name" varchar(50) NOT NULL,
  "duration" interval NOT NULL,
  "description" text,
  "price" integer NOT NULL CHECK ("price" >= 0),
  "book_limit" integer NOT NULL CHECK ("book_limit" >= 0),
  "editor_limit" integer NOT NULL CHECK ("editor_limit" >= 0),
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  UNIQUE ("name", "duration"),
  CHECK ("duration" > interval '0')
);

CREATE TABLE "payments" (
  "id" uuid PRIMARY KEY DEFAULT (uuidv7()),
  "publisher_id" uuid,
  "plan_id" uuid,
  "publisher_name" varchar(255) NOT NULL,
  "plan_name" varchar(50) NOT NULL,
  "duration" interval NOT NULL CHECK ("duration" > interval '0'),
  "book_limit" integer NOT NULL CHECK ("book_limit" >= 0),
  "editor_limit" integer NOT NULL CHECK ("editor_limit" >= 0),
  "price" integer NOT NULL CHECK ("price" >= 0),
  "vnp_txn_ref" varchar(100) UNIQUE NOT NULL,
  "vnp_create_date" char(14),
  "vnp_transaction_no" varchar(50),
  "status" payment_status NOT NULL DEFAULT 'pending',
  "period_starts_at" timestamptz,
  "period_ends_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  CONSTRAINT "payments_period_check" CHECK ("period_ends_at" > "period_starts_at"),
  CONSTRAINT "payments_success_period_check" CHECK ("status" <> 'success' OR ("period_starts_at" IS NOT NULL AND "period_ends_at" IS NOT NULL))
);

CREATE UNIQUE INDEX ON "refresh_tokens" ("token_hash");

CREATE INDEX ON "refresh_tokens" ("user_id");

CREATE INDEX ON "payments" ("publisher_id", "created_at");

CREATE INDEX ON "payments" ("publisher_id", "status", "period_ends_at");

CREATE UNIQUE INDEX ON "providers" ("provider", "provider_key");

CREATE UNIQUE INDEX ON "providers" ("user_id", "provider");

CREATE INDEX ON "publishers" ("publisher_name");

CREATE INDEX ON "publishers" USING GIN ("search_text" gin_trgm_ops);

CREATE INDEX ON "books" USING GIN ("search_text" gin_trgm_ops);

CREATE UNIQUE INDEX ON "book_genres" ("book_id", "genre_id");

CREATE UNIQUE INDEX ON "book_reviews" ("user_id", "book_id");

CREATE INDEX ON "book_reviews" ("book_id");

CREATE UNIQUE INDEX ON "survey_answers" ("user_id", "survey_id");

CREATE INDEX ON "surveys" ("publisher_id");

CREATE INDEX ON "surveys" ("starts_at", "ends_at");

COMMENT ON TABLE "users" IS 'Bảng người dùng.';

COMMENT ON COLUMN "users"."status" IS 'Nếu bị khóa thì thành locked, lúc đó tài khoản liên kết cũng chết luôn.';

COMMENT ON COLUMN "users"."notification_email_verified" IS 'Cái tài khoản đầu tiên đăng ký thì sẽ mặc định true, những lần đổi sau LUÔN phải xác nhận bằng email';

COMMENT ON COLUMN "users"."avatar_url" IS 'URL ảnh trên Cloudinary';

COMMENT ON TABLE "refresh_tokens" IS 'Mỗi dòng là một phiên đăng nhập (FR-03, FR-04, FR-06).
Đăng nhập trên nhiều thiết bị có nhiều dòng.
';

COMMENT ON COLUMN "refresh_tokens"."token_hash" IS 'SHA-256 của refresh token, token gốc chỉ nằm trong cookie';

COMMENT ON TABLE "providers" IS 'Liên kết đăng nhập. Có thể dùng cho local, google. Tương lai thêm Facebook.

Với các phương pháp đăng nhập qua OAuth thì verified tự động = true. Nhưng nếu là
local thì sẽ cần phải xác minh email.
';

COMMENT ON COLUMN "providers"."provider_key" IS 'ID "sub" Google trả về';

COMMENT ON COLUMN "providers"."password_hash" IS 'null khi OAuth';

COMMENT ON TABLE "publishers" IS 'Hồ sơ của nhà xuất bản.
Mỗi nhà xuất bản chỉ có một tài khoản duy nhất.
Mặc dù đã có name, avatar_url và bio ở bên users,
vẫn dùng publisher_name, logo_url và description
để về sau giả sử có thể tùy biến cho trang phát hành.
';

COMMENT ON COLUMN "publishers"."publisher_name" IS 'Tên tổ chức';

COMMENT ON COLUMN "publishers"."slug" IS 'Dùng cho URL trang NXB (FR-17)';

COMMENT ON COLUMN "publishers"."search_text" IS 'Xây từ publisher_name, không dấu, dùng GIN';

COMMENT ON TABLE "editors" IS 'Biên tập viên do nhà xuất bản tạo.
Những cột như name, bio, avatar_url đã có sẵn bên users.
';

COMMENT ON TABLE "books" IS 'Sách được xuất bản/phát hành. Do hiện tại đã không còn mô hình
work - edition, mỗi cuồn sách sẽ thuộc hẳn về một nhà xuất bản/
phát hành luôn.
';

COMMENT ON COLUMN "books"."title" IS 'Tên phổ biến tại Việt Nam';

COMMENT ON COLUMN "books"."description" IS 'Giới thiệu nội dung tác phẩm';

COMMENT ON COLUMN "books"."rating_avg" IS 'Cache điểm tác phẩm trung bình. Tính lại trong cùng transaction khi thêm, sửa, xóa, ẩn đánh giá';

COMMENT ON COLUMN "books"."search_text" IS 'Lưu search text, xây từ title || các trường trong json contributors';

COMMENT ON TABLE "genres" IS 'Danh mục thể loại, được tạo bởi admin.
Được lấy từ những thể loại chung nhất, kiểu:
- Văn học Việt Nam
- Văn học nước ngoài
- Truyện tranh
- Kinh tế
- Lịch sử
- Tâm lý
- Triết học
- ...
Có thể mail góp ý admin để admin thêm.
';

COMMENT ON COLUMN "genres"."name" IS 'Ví dụ: Tiểu thuyết, Kỹ năng sống';

COMMENT ON TABLE "book_genres" IS 'Một tác phẩm thuộc nhiều thể loại.';

COMMENT ON TABLE "book_reviews" IS 'Điểm chấm cho sách. Nếu bị xóa thì mất luôn, không để hidden.
Nếu bị xóa thì gửi mail cho người dùng, không được kháng cáo.
';

COMMENT ON COLUMN "book_reviews"."rating" IS 'Điểm tác phẩm 1–5, chỉ số nguyên';

COMMENT ON COLUMN "book_reviews"."comment" IS 'Nội dung đánh giá, không bắt buộc';

COMMENT ON COLUMN "book_reviews"."updated_at" IS 'Khác created_at = đã chỉnh sửa (FR-21)';

COMMENT ON TABLE "surveys" IS 'Khảo sát do biên tập viên tạo. Đặt lịch start/end, chỉ sửa được nội dung trước khi start. Mọi kết quả đều chỉ nhà xuất bản xem được.';

COMMENT ON COLUMN "surveys"."survey_status" IS 'hidden/active. hidden có thể thực hiện ngay trong lúc đang survey';

COMMENT ON COLUMN "surveys"."survey_content" IS 'câu hỏi dưới dạng json';

COMMENT ON TABLE "survey_answers" IS 'Phiếu bầu của người dùng.';

COMMENT ON COLUMN "survey_answers"."survey_answer_content" IS 'câu trả lời của người dùng dưới dạng json';

COMMENT ON COLUMN "survey_answers"."created_at" IS 'Lần bỏ phiếu đầu';

COMMENT ON COLUMN "survey_answers"."updated_at" IS 'Lần đổi phiếu gần nhất';

COMMENT ON TABLE "violation_reports" IS 'Reports: Những tài nguyên nào có thể bị report vì sai phạm?
  - Review: Admin xử lý
  - Sách: Editor xử lý
';

COMMENT ON COLUMN "violation_reports"."target_type" IS 'Loại nội dung bị báo cáo';

COMMENT ON COLUMN "violation_reports"."target_id" IS 'ID nội dung, KHÔNG phải FK. Bảng tùy theo target_type';

COMMENT ON COLUMN "violation_reports"."description" IS 'Lí do báo cáo';

COMMENT ON TABLE "system_logs" IS 'Logs: Những hành động nào có thể bị log lại?
  - Độc giả:
    - Đánh giá sách.
        - Độc giả xem được.
        - Nhà xuất bản xem được.
  - Nhà xuất bản:
    - Tạo biên tập viên.
        - Nhà xuất bản xem được
        - Biên tập viên xem được.
  - Admin:
    - Xóa review độc giả.
        - Admin xem được
        - Độc giả xem được
    - Tạo admin khác
      - Admin xem được
    - Khóa account độc giả
      - Admin xem được
';

COMMENT ON COLUMN "system_logs"."action_type" IS 'Bảng này sẽ không thực sự có FK, nếu có nối thì dựa vào type ở đây';

ALTER TABLE "refresh_tokens" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "providers" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "publishers" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "editors" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "editors" ADD FOREIGN KEY ("publisher_id") REFERENCES "publishers" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "books" ADD FOREIGN KEY ("publisher_id") REFERENCES "publishers" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "book_genres" ADD FOREIGN KEY ("book_id") REFERENCES "books" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "book_genres" ADD FOREIGN KEY ("genre_id") REFERENCES "genres" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "book_reviews" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "book_reviews" ADD FOREIGN KEY ("book_id") REFERENCES "books" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "surveys" ADD FOREIGN KEY ("publisher_id") REFERENCES "publishers" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "survey_answers" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "survey_answers" ADD FOREIGN KEY ("survey_id") REFERENCES "surveys" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "violation_reports" ADD FOREIGN KEY ("reporter_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "payments" ADD FOREIGN KEY ("publisher_id") REFERENCES "publishers" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "payments" ADD FOREIGN KEY ("plan_id") REFERENCES "plans" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

/* Gói Free: migration tạo sẵn (price 0, duration 'infinity', hạn mức 0), là dòng duy nhất có duration infinity.
   Nhận diện bằng duration vì admin đổi được tên (và mô tả, hạn mức); chặn đổi duration, price, is_active */

CREATE FUNCTION "protect_free_plan"() RETURNS trigger AS $$
BEGIN
  IF OLD."duration" = 'infinity' AND (
    NEW."duration" IS DISTINCT FROM OLD."duration"
    OR NEW."price" IS DISTINCT FROM OLD."price"
    OR NEW."is_active" IS DISTINCT FROM OLD."is_active"
  ) THEN
    RAISE EXCEPTION 'Không được đổi duration, price, is_active của gói Free';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "plans_protect_free_plan"
BEFORE UPDATE ON "plans"
FOR EACH ROW EXECUTE FUNCTION "protect_free_plan"();

COMMENT ON TABLE "plans" IS 'Gói hội viên NXB. duration là interval (6 months, 1 year…); gói "Free" có duration = infinity, migration tạo sẵn.';

COMMENT ON TABLE "payments" IS 'Lịch sử mua gói. Gói hiện tại của NXB = dòng success có period_ends_at > now(); không có thì là gói "Free".';

COMMENT ON COLUMN "payments"."price" IS 'Giá lúc mua, đổi plans.price sau này không ảnh hưởng lịch sử.';

COMMENT ON COLUMN "payments"."publisher_name" IS 'Snapshot lúc mua: NXB hoặc gói bị xóa (publisher_id / plan_id thành NULL) thì lịch sử vẫn đọc được.';

COMMENT ON COLUMN "payments"."vnp_transaction_no" IS 'Mã giao dịch VNPAY, điền khi nhận IPN.';
