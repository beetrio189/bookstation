CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE FUNCTION f_unaccent(text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT public.unaccent('public.unaccent', $1) $$;

COMMENT ON FUNCTION f_unaccent(text) IS 'Bản IMMUTABLE của unaccent(). Dùng chung khi xây search_text và khi chuẩn hóa từ khóa tìm kiếm:
f_unaccent(lower(normalize(x, NFC))). Không bỏ dấu ở tầng ứng dụng.
';

CREATE TYPE "publisher_status" AS ENUM (
  'pending',
  'verified',
  'rejected'
);

CREATE TYPE "oauth_provider" AS ENUM (
  'google'
);

CREATE TYPE "edition_contributor_role" AS ENUM (
  'translator',
  'illustrator',
  'editor'
);

CREATE TYPE "shelf_status" AS ENUM (
  'want_to_read',
  'reading',
  'read'
);

CREATE TYPE "survey_result_visibility" AS ENUM (
  'realtime',
  'after_close'
);

CREATE TYPE "report_status" AS ENUM (
  'pending',
  'resolved',
  'dismissed'
);

CREATE TYPE "content_report_target_type" AS ENUM (
  'work_review',
  'edition_review'
);

CREATE TYPE "content_report_reason" AS ENUM (
  'spam',
  'offensive',
  'spoiler',
  'misleading',
  'other'
);

CREATE TYPE "revision_entity_type" AS ENUM (
  'work',
  'edition',
  'contributor'
);

CREATE TYPE "revision_action" AS ENUM (
  'create',
  'update',
  'restore',
  'merge'
);

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "email" varchar(255) UNIQUE NOT NULL,
  "password_hash" varchar(255),
  "display_name" varchar(100) NOT NULL,
  "avatar_url" text,
  "bio" text,
  "email_verified_at" timestamptz,
  "locked_at" timestamptz,
  "locked_reason" text,
  "locked_by" uuid,
  "last_login_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "oauth_accounts" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "user_id" uuid NOT NULL,
  "provider" oauth_provider NOT NULL,
  "provider_user_id" varchar(255) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "publishers" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "user_id" uuid UNIQUE NOT NULL,
  "name" varchar(255) NOT NULL,
  "slug" varchar(255) UNIQUE NOT NULL,
  "tax_code" varchar(14) UNIQUE NOT NULL,
  "logo_url" text,
  "description" text,
  "website" varchar(255),
  "status" publisher_status NOT NULL DEFAULT 'pending',
  "rejection_reason" text,
  "reviewed_by" uuid,
  "reviewed_at" timestamptz,
  "submitted_at" timestamptz NOT NULL DEFAULT (now()),
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "publisher_isbn_prefixes" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "publisher_id" uuid NOT NULL,
  "prefix" varchar(12) UNIQUE NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "roles" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "code" varchar(50) UNIQUE NOT NULL,
  "name" varchar(100) NOT NULL,
  "description" text,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "permissions" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "code" varchar(100) UNIQUE NOT NULL,
  "description" text,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "role_permissions" (
  "role_id" uuid NOT NULL,
  "permission_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  PRIMARY KEY ("role_id", "permission_id")
);

CREATE TABLE "user_roles" (
  "user_id" uuid NOT NULL,
  "role_id" uuid NOT NULL,
  "granted_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  PRIMARY KEY ("user_id", "role_id")
);

CREATE TABLE "works" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "title" varchar(500) NOT NULL,
  "original_title" varchar(500),
  "slug" varchar(255) UNIQUE NOT NULL,
  "description" text,
  "original_language" varchar(10),
  "first_published_year" smallint,
  "default_edition_id" uuid,
  "merged_into_id" uuid,
  "work_rating_avg" numeric(3,2),
  "work_rating_count" integer NOT NULL DEFAULT 0,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "editions" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "work_id" uuid NOT NULL,
  "isbn13" varchar(13) UNIQUE NOT NULL,
  "title" varchar(500) NOT NULL,
  "subtitle" varchar(500),
  "publisher_name" varchar(255),
  "language" varchar(10) NOT NULL DEFAULT 'vi',
  "published_year" smallint,
  "page_count" integer,
  "cover_url" text,
  "description" text,
  "managed_by_publisher_id" uuid,
  "managed_at" timestamptz,
  "edition_rating_avg" numeric(3,2),
  "edition_rating_count" integer NOT NULL DEFAULT 0,
  "search_text" text NOT NULL DEFAULT '',
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "contributors" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "name" varchar(255) NOT NULL,
  "slug" varchar(255) UNIQUE NOT NULL,
  "bio" text,
  "photo_url" text,
  "birth_year" smallint,
  "death_year" smallint,
  "search_text" text NOT NULL DEFAULT '',
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "work_contributors" (
  "work_id" uuid NOT NULL,
  "contributor_id" uuid NOT NULL,
  "position" smallint NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  PRIMARY KEY ("work_id", "contributor_id")
);

CREATE TABLE "edition_contributors" (
  "edition_id" uuid NOT NULL,
  "contributor_id" uuid NOT NULL,
  "role" edition_contributor_role NOT NULL,
  "position" smallint NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  PRIMARY KEY ("edition_id", "contributor_id", "role")
);

CREATE TABLE "genres" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "name" varchar(100) UNIQUE NOT NULL,
  "slug" varchar(100) UNIQUE NOT NULL,
  "description" text,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "work_genres" (
  "work_id" uuid NOT NULL,
  "genre_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  PRIMARY KEY ("work_id", "genre_id")
);

CREATE TABLE "shelf_entries" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "user_id" uuid NOT NULL,
  "edition_id" uuid NOT NULL,
  "status" shelf_status NOT NULL,
  "current_page" integer,
  "started_at" date,
  "finished_at" date,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "shelf_events" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "user_id" uuid NOT NULL,
  "edition_id" uuid NOT NULL,
  "from_status" shelf_status,
  "to_status" shelf_status,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "work_reviews" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "user_id" uuid NOT NULL,
  "work_id" uuid NOT NULL,
  "rating" smallint NOT NULL,
  "content" text,
  "hidden_at" timestamptz,
  "hidden_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "edition_reviews" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "user_id" uuid NOT NULL,
  "edition_id" uuid NOT NULL,
  "rating" smallint NOT NULL,
  "comment" text,
  "hidden_at" timestamptz,
  "hidden_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "challenges" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "publisher_id" uuid NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text,
  "starts_at" timestamptz NOT NULL,
  "ends_at" timestamptz NOT NULL,
  "target_count" smallint NOT NULL,
  "badge_name" varchar(100) NOT NULL,
  "badge_image_url" text,
  "cancelled_at" timestamptz,
  "hidden_at" timestamptz,
  "hidden_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "challenge_works" (
  "challenge_id" uuid NOT NULL,
  "work_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  PRIMARY KEY ("challenge_id", "work_id")
);

CREATE TABLE "challenge_participants" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "challenge_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "challenge_progress" (
  "participant_id" uuid NOT NULL,
  "work_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  PRIMARY KEY ("participant_id", "work_id")
);

CREATE TABLE "surveys" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "publisher_id" uuid NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text,
  "starts_at" timestamptz NOT NULL,
  "ends_at" timestamptz NOT NULL,
  "result_visibility" survey_result_visibility NOT NULL DEFAULT 'after_close',
  "closed_at" timestamptz,
  "hidden_at" timestamptz,
  "hidden_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "survey_questions" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "survey_id" uuid NOT NULL,
  "content" text NOT NULL,
  "position" smallint NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "survey_options" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "question_id" uuid NOT NULL,
  "content" varchar(500) NOT NULL,
  "work_id" uuid,
  "position" smallint NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "survey_votes" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "user_id" uuid NOT NULL,
  "survey_id" uuid NOT NULL,
  "question_id" uuid NOT NULL,
  "option_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "content_reports" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "reporter_id" uuid NOT NULL,
  "target_type" content_report_target_type NOT NULL,
  "target_id" uuid NOT NULL,
  "reason" content_report_reason NOT NULL,
  "description" text,
  "status" report_status NOT NULL DEFAULT 'pending',
  "content_hidden" boolean NOT NULL DEFAULT false,
  "account_locked" boolean NOT NULL DEFAULT false,
  "handled_by" uuid,
  "handled_at" timestamptz,
  "resolution_note" text,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "edition_reports" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "reporter_id" uuid NOT NULL,
  "edition_id" uuid NOT NULL,
  "field" varchar(50),
  "description" text NOT NULL,
  "status" report_status NOT NULL DEFAULT 'pending',
  "handled_by" uuid,
  "handled_at" timestamptz,
  "resolution_note" text,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "revisions" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "entity_type" revision_entity_type NOT NULL,
  "entity_id" uuid NOT NULL,
  "revision_number" integer NOT NULL,
  "action" revision_action NOT NULL,
  "snapshot" jsonb NOT NULL,
  "changed_fields" text[],
  "restored_from_id" uuid,
  "note" text,
  "changed_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE UNIQUE INDEX ON "oauth_accounts" ("provider", "provider_user_id");

CREATE UNIQUE INDEX ON "oauth_accounts" ("user_id", "provider");

CREATE INDEX ON "publishers" ("status");

CREATE INDEX ON "publisher_isbn_prefixes" ("publisher_id");

CREATE INDEX ON "role_permissions" ("permission_id");

CREATE INDEX ON "user_roles" ("role_id");

CREATE INDEX ON "works" ("merged_into_id");

CREATE INDEX ON "editions" ("work_id");

CREATE INDEX ON "editions" ("managed_by_publisher_id");

CREATE INDEX ON "editions" ("publisher_name");

CREATE INDEX ON "editions" ("language");

CREATE UNIQUE INDEX ON "editions" ("id", "work_id");

CREATE INDEX ON "editions" ("isbn13" text_pattern_ops);

CREATE INDEX ON "editions" USING GIN ("search_text" gin_trgm_ops);

CREATE INDEX ON "contributors" USING GIN ("search_text" gin_trgm_ops);

CREATE INDEX ON "work_contributors" ("contributor_id");

CREATE INDEX ON "edition_contributors" ("contributor_id");

CREATE INDEX ON "work_genres" ("genre_id");

CREATE UNIQUE INDEX ON "shelf_entries" ("user_id", "edition_id");

CREATE INDEX ON "shelf_entries" ("user_id", "status");

CREATE INDEX ON "shelf_entries" ("edition_id");

CREATE INDEX ON "shelf_events" ("edition_id", "created_at");

CREATE INDEX ON "shelf_events" ("user_id", "created_at");

CREATE UNIQUE INDEX ON "work_reviews" ("user_id", "work_id");

CREATE INDEX ON "work_reviews" ("work_id", "created_at");

CREATE UNIQUE INDEX ON "edition_reviews" ("user_id", "edition_id");

CREATE INDEX ON "edition_reviews" ("edition_id", "created_at");

CREATE INDEX ON "challenges" ("publisher_id");

CREATE INDEX ON "challenges" ("starts_at", "ends_at");

CREATE INDEX ON "challenge_works" ("work_id");

CREATE UNIQUE INDEX ON "challenge_participants" ("challenge_id", "user_id");

CREATE INDEX ON "challenge_participants" ("user_id", "completed_at");

CREATE INDEX ON "surveys" ("publisher_id");

CREATE INDEX ON "surveys" ("starts_at", "ends_at");

CREATE INDEX ON "survey_questions" ("survey_id", "position");

CREATE UNIQUE INDEX ON "survey_questions" ("id", "survey_id");

CREATE INDEX ON "survey_options" ("question_id", "position");

CREATE UNIQUE INDEX ON "survey_options" ("id", "question_id");

CREATE UNIQUE INDEX ON "survey_votes" ("user_id", "question_id");

CREATE INDEX ON "survey_votes" ("question_id", "option_id");

CREATE INDEX ON "survey_votes" ("survey_id", "user_id");

CREATE INDEX ON "content_reports" ("status", "created_at");

CREATE INDEX ON "content_reports" ("target_type", "target_id");

CREATE UNIQUE INDEX ON "content_reports" ("reporter_id", "target_type", "target_id");

CREATE INDEX ON "edition_reports" ("edition_id", "status");

CREATE INDEX ON "edition_reports" ("status", "created_at");

CREATE INDEX ON "edition_reports" ("reporter_id");

CREATE UNIQUE INDEX ON "revisions" ("entity_type", "entity_id", "revision_number");

CREATE INDEX ON "revisions" ("changed_by");

COMMENT ON TABLE "users" IS 'Mọi tài khoản. Vai trò nằm ở user_roles (nhóm 2).
Token xác nhận email / khôi phục mật khẩu lưu ở Redis, không lưu ở đây.
';

COMMENT ON COLUMN "users"."email" IS 'Lưu dạng chữ thường';

COMMENT ON COLUMN "users"."password_hash" IS 'Null nếu chỉ đăng nhập bằng Google';

COMMENT ON COLUMN "users"."avatar_url" IS 'URL ảnh trên Cloudinary';

COMMENT ON COLUMN "users"."email_verified_at" IS 'Null = chưa xác nhận email (FR-02)';

COMMENT ON COLUMN "users"."locked_at" IS 'Null = đang hoạt động (FR-10)';

COMMENT ON COLUMN "users"."locked_by" IS 'Admin đã khóa';

COMMENT ON TABLE "oauth_accounts" IS 'Liên kết đăng nhập bên ngoài (FR-03). Mỗi user tối đa một tài khoản cho mỗi provider.';

COMMENT ON COLUMN "oauth_accounts"."provider_user_id" IS 'ID "sub" Google trả về';

COMMENT ON TABLE "publishers" IS 'Hồ sơ tổ chức của tài khoản NXB, 1-1 với users (FR-08).
Email tên miền công ty chính là users.email.
User có hồ sơ này phải có role publisher trong user_roles (kiểm tra ở tầng ứng dụng).
';

COMMENT ON COLUMN "publishers"."name" IS 'Tên tổ chức';

COMMENT ON COLUMN "publishers"."slug" IS 'Dùng cho URL trang NXB (FR-17)';

COMMENT ON COLUMN "publishers"."tax_code" IS 'Mã số thuế: 10 số hoặc 10-3';

COMMENT ON COLUMN "publishers"."rejection_reason" IS 'Bắt buộc khi status = rejected (FR-32)';

COMMENT ON COLUMN "publishers"."reviewed_by" IS 'Admin đã duyệt hoặc từ chối';

COMMENT ON COLUMN "publishers"."submitted_at" IS 'Lần gửi hồ sơ gần nhất, cập nhật khi gửi lại';

COMMENT ON TABLE "publisher_isbn_prefixes" IS 'Mỗi NXB có nhiều prefix, mỗi prefix thuộc một NXB.
Kiểm tra ở tầng ứng dụng:
- Định dạng: 978604 theo sau bởi 1-5 chữ số, chỉ chữ số.
- Không lồng nhau với prefix đã có (ví dụ 9786041 và 97860412): Admin từ chối khi duyệt.
';

COMMENT ON COLUMN "publisher_isbn_prefixes"."prefix" IS 'Chỉ chữ số, dạng ISBN-13, ví dụ 978604123';

COMMENT ON TABLE "roles" IS 'Danh sách vai trò, seed sẵn khi migrate.';

COMMENT ON COLUMN "roles"."code" IS 'reader, librarian, publisher, admin';

COMMENT ON COLUMN "roles"."name" IS 'Tên hiển thị: Độc giả, Thủ thư, Nhà xuất bản, Quản trị viên';

COMMENT ON TABLE "permissions" IS 'Danh sách quyền, seed sẵn khi migrate.
Chỉ nói "được làm hành động gì". Điều kiện theo dữ liệu
(ví dụ chỉ ấn bản chưa có NXB quản lý) viết ở tầng ứng dụng (ABAC).
';

COMMENT ON COLUMN "permissions"."code" IS 'Dạng resource.action, ví dụ edition.update';

COMMENT ON TABLE "role_permissions" IS 'Vai trò nào có quyền nào.';

COMMENT ON TABLE "user_roles" IS 'User nào có vai trò nào.
Đăng ký độc giả: gán reader. Đăng ký NXB: gán publisher.
Thủ thư: user có cả reader và librarian. Thu hồi = xóa dòng librarian.
';

COMMENT ON COLUMN "user_roles"."granted_by" IS 'Admin cấp quyền (FR-11). Null nếu hệ thống tự gán khi đăng ký';

COMMENT ON COLUMN "user_roles"."created_at" IS 'Thời điểm được cấp vai trò';

COMMENT ON TABLE "works" IS 'Tác phẩm ở mức nội dung, không phụ thuộc bản in (FR-24).
default_edition_id phải thuộc chính tác phẩm này:
dùng FK ghép (default_edition_id, id) -> editions(id, work_id).
';

COMMENT ON COLUMN "works"."title" IS 'Tên phổ biến tại Việt Nam';

COMMENT ON COLUMN "works"."original_title" IS 'Tên gốc, ví dụ "Norwegian Wood"';

COMMENT ON COLUMN "works"."description" IS 'Giới thiệu nội dung tác phẩm';

COMMENT ON COLUMN "works"."original_language" IS 'Mã ISO 639-1: vi, en, ja...';

COMMENT ON COLUMN "works"."default_edition_id" IS 'Ấn bản hiển thị mặc định. Null khi chưa có ấn bản';

COMMENT ON COLUMN "works"."merged_into_id" IS 'Khác null = đã bị gộp vào tác phẩm khác (FR-29), dùng để redirect';

COMMENT ON COLUMN "works"."work_rating_avg" IS 'Cache điểm tác phẩm trung bình. Tính lại trong cùng transaction khi thêm, sửa, xóa, ẩn đánh giá';

COMMENT ON COLUMN "works"."created_by" IS 'Thủ thư hoặc NXB đã tạo';

COMMENT ON TABLE "editions" IS 'Từng bản in cụ thể của một tác phẩm (FR-25). Mọi ấn bản bắt buộc có ISBN.
Tìm kiếm (FR-12) trả về từng ấn bản, không nhóm theo tác phẩm.
Index isbn13 text_pattern_ops để LIKE ''prefix%'' dùng được index khi gán quyền theo ISBN prefix.
';

COMMENT ON COLUMN "editions"."isbn13" IS 'Bắt buộc. Chuẩn hóa về ISBN-13, chỉ chữ số';

COMMENT ON COLUMN "editions"."title" IS 'Tên in trên ấn bản này, có thể khác tên tác phẩm';

COMMENT ON COLUMN "editions"."publisher_name" IS 'Tên NXB in trên sách, dùng để hiển thị và lọc (FR-13)';

COMMENT ON COLUMN "editions"."language" IS 'Mã ISO 639-1';

COMMENT ON COLUMN "editions"."cover_url" IS 'URL ảnh bìa trên Cloudinary';

COMMENT ON COLUMN "editions"."managed_by_publisher_id" IS 'NXB đang quản lý. Null = Thủ thư được sửa (FR-27, FR-33)';

COMMENT ON COLUMN "editions"."managed_at" IS 'Thời điểm được gán quyền quản lý';

COMMENT ON COLUMN "editions"."edition_rating_avg" IS 'Cache điểm ấn bản trung bình. Tính lại trong cùng transaction khi thêm, sửa, xóa, ẩn đánh giá';

COMMENT ON COLUMN "editions"."search_text" IS 'Không dấu, chữ thường: tên ấn bản, contributor của ấn bản, tác giả của tác phẩm.
Chỉ ghi qua rebuild_edition_search_text(), gọi trong cùng transaction khi:
- Thêm ấn bản, sửa title, chuyển ấn bản sang tác phẩm khác: ấn bản đó.
- Thêm/bỏ edition_contributors: ấn bản đó.
- Thêm/bỏ work_contributors: mọi ấn bản của tác phẩm.
- Đổi tên contributor: mọi ấn bản liên quan (qua tác phẩm hoặc qua ấn bản).
';

COMMENT ON TABLE "contributors" IS 'Người đóng góp dùng chung: tác giả, dịch giả, họa sĩ (FR-28).
Chỉ Thủ thư và Admin được sửa. NXB chỉ được thêm mới và liên kết.
';

COMMENT ON COLUMN "contributors"."name" IS 'Tên hiển thị, ví dụ "Haruki Murakami"';

COMMENT ON COLUMN "contributors"."slug" IS 'Dùng cho URL trang tác giả (FR-16)';

COMMENT ON COLUMN "contributors"."photo_url" IS 'Ảnh trên Cloudinary';

COMMENT ON COLUMN "contributors"."search_text" IS 'f_unaccent(lower(normalize(name, NFC))), cập nhật khi đổi tên';

COMMENT ON TABLE "work_contributors" IS 'Tác giả của tác phẩm.';

COMMENT ON COLUMN "work_contributors"."position" IS 'Thứ tự hiển thị khi có nhiều tác giả';

COMMENT ON TABLE "edition_contributors" IS 'Dịch giả, họa sĩ, biên tập viên của từng ấn bản.';

COMMENT ON TABLE "genres" IS 'Danh mục thể loại, dùng cho bộ lọc (FR-13).';

COMMENT ON COLUMN "genres"."name" IS 'Ví dụ: Tiểu thuyết, Kỹ năng sống';

COMMENT ON TABLE "work_genres" IS 'Một tác phẩm thuộc nhiều thể loại.';

COMMENT ON TABLE "shelf_entries" IS 'Trạng thái HIỆN TẠI trên kệ (FR-18). Xóa khỏi kệ = xóa dòng.
Độc giả có thể để nhiều ấn bản của cùng một tác phẩm trên kệ.
';

COMMENT ON COLUMN "shelf_entries"."current_page" IS 'Trang đang đọc của ấn bản này. Tiến độ một tác phẩm trong thử thách
= tỉ lệ current_page / page_count cao nhất trong các ấn bản của tác phẩm đó.
Không vượt quá editions.page_count: kiểm tra ở tầng ứng dụng.
';

COMMENT ON COLUMN "shelf_entries"."started_at" IS 'Ngày bắt đầu đọc, độc giả tự nhập hoặc tự điền khi chuyển sang Đang đọc';

COMMENT ON COLUMN "shelf_entries"."finished_at" IS 'Ngày đọc xong';

COMMENT ON COLUMN "shelf_entries"."created_at" IS 'Lần đầu thêm vào kệ';

COMMENT ON COLUMN "shelf_entries"."updated_at" IS 'Lần chuyển kệ gần nhất';

COMMENT ON TABLE "shelf_events" IS 'Nhật ký chỉ thêm, không sửa, không xóa. Ghi trong cùng transaction với shelf_entries.
updated_at luôn bằng created_at, giữ cho đồng bộ quy ước.
';

COMMENT ON COLUMN "shelf_events"."from_status" IS 'Null = vừa thêm vào kệ';

COMMENT ON COLUMN "shelf_events"."to_status" IS 'Null = xóa khỏi kệ';

COMMENT ON COLUMN "shelf_events"."created_at" IS 'Thời điểm xảy ra sự kiện';

COMMENT ON TABLE "work_reviews" IS 'Điểm tác phẩm kèm nội dung đánh giá (FR-20). Gộp vào works.work_rating_avg.
Đánh giá bị ẩn không tính vào điểm trung bình.
';

COMMENT ON COLUMN "work_reviews"."rating" IS 'Điểm tác phẩm 1–5';

COMMENT ON COLUMN "work_reviews"."content" IS 'Nội dung đánh giá, không bắt buộc';

COMMENT ON COLUMN "work_reviews"."hidden_at" IS 'Khác null = bị Admin ẩn (FR-55)';

COMMENT ON COLUMN "work_reviews"."updated_at" IS 'Khác created_at = đã chỉnh sửa (FR-21)';

COMMENT ON TABLE "edition_reviews" IS 'Điểm ấn bản kèm nhận xét ấn bản (FR-20). Gộp vào editions.edition_rating_avg.
NXB chỉ đọc, không sửa, ẩn hay xóa được.
';

COMMENT ON COLUMN "edition_reviews"."rating" IS 'Điểm ấn bản 1–5';

COMMENT ON COLUMN "edition_reviews"."comment" IS 'Nhận xét về bản dịch, chất lượng in, không bắt buộc';

COMMENT ON TABLE "challenges" IS 'Thử thách đọc: đọc xong target_count tác phẩm trong danh sách, trong khoảng thời gian (FR-39).
Trạng thái suy ra từ thời gian: chưa bắt đầu / đang diễn ra / đã kết thúc.
NXB chỉ sửa hoặc hủy khi now() < starts_at (FR-40).
target_count <= số tác phẩm trong challenge_works: kiểm tra ở tầng ứng dụng.
';

COMMENT ON COLUMN "challenges"."target_count" IS 'Số tác phẩm cần đọc xong để hoàn thành';

COMMENT ON COLUMN "challenges"."badge_name" IS 'Tên huy hiệu nhận được khi hoàn thành';

COMMENT ON COLUMN "challenges"."badge_image_url" IS 'Ảnh huy hiệu trên Cloudinary';

COMMENT ON COLUMN "challenges"."cancelled_at" IS 'NXB hủy trước khi bắt đầu (FR-40)';

COMMENT ON COLUMN "challenges"."hidden_at" IS 'Admin ẩn do vi phạm (FR-56)';

COMMENT ON TABLE "challenge_works" IS 'Danh sách tác phẩm được tính trong thử thách.
NXB được chọn bất kỳ tác phẩm nào, không giới hạn sách do mình quản lý.
Đọc ấn bản nào của tác phẩm cũng được tính.
';

COMMENT ON TABLE "challenge_participants" IS 'Ai tham gia thử thách nào (FR-41).
Rời thử thách = xóa dòng, tiến độ bị xóa theo. Tham gia lại bắt đầu từ 0.
Huy hiệu của độc giả = các dòng có completed_at khác null.
';

COMMENT ON COLUMN "challenge_participants"."completed_at" IS 'Khác null = đã hoàn thành và nhận huy hiệu (FR-44)';

COMMENT ON COLUMN "challenge_participants"."created_at" IS 'Thời điểm tham gia';

COMMENT ON TABLE "challenge_progress" IS 'Tác phẩm đã đọc xong được tính cho người tham gia (FR-42). Số tác phẩm hoàn thành = COUNT số dòng.
Chỉ tính khi ấn bản được chuyển sang Đã đọc sau khi tham gia
và trong thời gian diễn ra. Chuyển ra khỏi Đã đọc không trừ tiến độ.
Tác phẩm đang đọc dở: tiến độ tính từ shelf_entries.current_page, không lưu ở đây.
work_id phải thuộc challenge_works của thử thách: kiểm tra ở tầng ứng dụng.
';

COMMENT ON COLUMN "challenge_progress"."participant_id" IS 'ON DELETE CASCADE';

COMMENT ON COLUMN "challenge_progress"."created_at" IS 'Thời điểm được tính';

COMMENT ON TABLE "surveys" IS 'Khảo sát do NXB tạo (FR-45). Có nhiều câu hỏi.
Chỉ sửa được (kể cả câu hỏi, lựa chọn) khi now() < starts_at.
NXB luôn xem được kết quả chi tiết (FR-52), chế độ hiển thị chỉ áp dụng cho độc giả (FR-48).
';

COMMENT ON COLUMN "surveys"."closed_at" IS 'NXB đóng sớm (FR-46). Thời điểm kết thúc thật = LEAST(ends_at, closed_at)';

COMMENT ON COLUMN "surveys"."hidden_at" IS 'Admin ẩn do vi phạm (FR-56)';

COMMENT ON TABLE "survey_questions" IS 'Mỗi khảo sát có ít nhất 1 câu hỏi: kiểm tra ở tầng ứng dụng.';

COMMENT ON COLUMN "survey_questions"."content" IS 'Nội dung câu hỏi';

COMMENT ON COLUMN "survey_questions"."position" IS 'Thứ tự hiển thị';

COMMENT ON TABLE "survey_options" IS 'Mỗi câu hỏi có ít nhất 2 lựa chọn: kiểm tra ở tầng ứng dụng.';

COMMENT ON COLUMN "survey_options"."content" IS 'Nội dung lựa chọn. Nếu gắn tác phẩm thì mặc định là tên tác phẩm';

COMMENT ON COLUMN "survey_options"."work_id" IS 'Không bắt buộc. Gắn với tác phẩm để hiện ảnh bìa, link';

COMMENT ON TABLE "survey_votes" IS 'Phiếu bầu (FR-47). Đổi phiếu = UPDATE option_id khi khảo sát còn mở.
Bắt buộc trả lời hết: app ghi phiếu cho mọi câu hỏi trong một transaction,
thiếu câu nào thì từ chối cả lần gửi.
Số người tham gia = COUNT(DISTINCT user_id) theo survey_id.
';

COMMENT ON COLUMN "survey_votes"."created_at" IS 'Lần bỏ phiếu đầu';

COMMENT ON COLUMN "survey_votes"."updated_at" IS 'Lần đổi phiếu gần nhất';

COMMENT ON TABLE "content_reports" IS 'Báo cáo nội dung vi phạm (FR-22, FR-54, FR-55). Admin xử lý.
Polymorphic: target_id trỏ tới work_reviews hoặc edition_reviews tùy target_type.
Mở rộng sau này (thử thách, khảo sát): thêm giá trị vào content_report_target_type.

Tầng ứng dụng phải tự đảm bảo:
- target_id tồn tại trong bảng tương ứng khi tạo báo cáo.
- Xóa báo cáo khi nội dung bị xóa (FR-21), trong cùng transaction.
- Không cho báo cáo nội dung của chính mình.
';

COMMENT ON COLUMN "content_reports"."target_type" IS 'Loại nội dung bị báo cáo';

COMMENT ON COLUMN "content_reports"."target_id" IS 'ID nội dung, KHÔNG phải FK. Bảng tùy theo target_type';

COMMENT ON COLUMN "content_reports"."description" IS 'Bắt buộc khi reason = other';

COMMENT ON COLUMN "content_reports"."content_hidden" IS 'Admin đã ẩn nội dung';

COMMENT ON COLUMN "content_reports"."account_locked" IS 'Admin đã khóa tài khoản người tạo nội dung';

COMMENT ON COLUMN "content_reports"."handled_by" IS 'Admin xử lý';

COMMENT ON TABLE "edition_reports" IS 'Báo cáo thông tin sách sai (FR-23, FR-31, FR-38).
Người xử lý (kiểm tra ở tầng ứng dụng):
- editions.managed_by_publisher_id khác null: NXB đó.
- Null: Thủ thư.
resolved = đã sửa thông tin, dismissed = thông tin vốn đúng.
';

COMMENT ON COLUMN "edition_reports"."field" IS 'Trường bị sai, ví dụ page_count, cover_url. Null = nhiều chỗ';

COMMENT ON COLUMN "edition_reports"."description" IS 'Mô tả sai ở đâu, thông tin đúng là gì';

COMMENT ON COLUMN "edition_reports"."handled_by" IS 'Thủ thư hoặc tài khoản NXB đã xử lý';

COMMENT ON TABLE "revisions" IS 'Lịch sử chỉnh sửa dữ liệu sách (FR-30). Chỉ thêm, không sửa, không xóa.
Ghi trong cùng transaction với thay đổi dữ liệu.
Snapshot gồm cả quan hệ để khôi phục đủ, ví dụ:
- work: tên, mô tả, danh sách tác giả, thể loại.
- edition: thông tin ấn bản, danh sách dịch giả/họa sĩ.
Quyền khôi phục: Thủ thư và Admin, ấn bản do NXB quản lý thì theo ABAC.
';

COMMENT ON COLUMN "revisions"."entity_id" IS 'ID bản ghi, KHÔNG phải FK, để lịch sử còn lại khi dữ liệu bị xóa';

COMMENT ON COLUMN "revisions"."revision_number" IS 'Số thứ tự 1, 2, 3... theo từng bản ghi';

COMMENT ON COLUMN "revisions"."snapshot" IS 'Toàn bộ dữ liệu SAU khi thay đổi, gồm cả quan hệ';

COMMENT ON COLUMN "revisions"."changed_fields" IS 'Các trường thay đổi so với revision trước, để hiển thị nhanh';

COMMENT ON COLUMN "revisions"."restored_from_id" IS 'Khác null khi action = restore';

COMMENT ON COLUMN "revisions"."note" IS 'Lý do chỉnh sửa, ví dụ "Theo báo cáo #123"';

COMMENT ON COLUMN "revisions"."changed_by" IS 'Null = hệ thống tự thay đổi';

ALTER TABLE "users" ADD CHECK ((locked_at IS NULL) = (locked_by IS NULL));

ALTER TABLE "publishers" ADD CHECK (status <> 'rejected' OR rejection_reason IS NOT NULL);

ALTER TABLE "publishers" ADD CHECK ((reviewed_at IS NULL) = (reviewed_by IS NULL));

ALTER TABLE "works" ADD CHECK (merged_into_id IS NULL OR merged_into_id <> id);

ALTER TABLE "works" ADD CHECK (work_rating_avg IS NULL OR work_rating_avg BETWEEN 1 AND 5);

ALTER TABLE "editions" ADD CHECK (isbn13 ~ '^97[89][0-9]{10}$');

ALTER TABLE "editions" ADD CHECK (page_count IS NULL OR page_count > 0);

ALTER TABLE "editions" ADD CHECK ((managed_by_publisher_id IS NULL) = (managed_at IS NULL));

ALTER TABLE "editions" ADD CHECK (edition_rating_avg IS NULL OR edition_rating_avg BETWEEN 1 AND 5);

ALTER TABLE "contributors" ADD CHECK (death_year IS NULL OR birth_year IS NULL OR death_year >= birth_year);

ALTER TABLE "shelf_entries" ADD CHECK (current_page IS NULL OR current_page >= 0);

ALTER TABLE "shelf_entries" ADD CHECK (finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at);

ALTER TABLE "shelf_events" ADD CHECK (from_status IS NOT NULL OR to_status IS NOT NULL);

ALTER TABLE "shelf_events" ADD CHECK (from_status IS DISTINCT FROM to_status);

ALTER TABLE "work_reviews" ADD CHECK (rating BETWEEN 1 AND 5);

ALTER TABLE "work_reviews" ADD CHECK ((hidden_at IS NULL) = (hidden_by IS NULL));

ALTER TABLE "edition_reviews" ADD CHECK (rating BETWEEN 1 AND 5);

ALTER TABLE "edition_reviews" ADD CHECK ((hidden_at IS NULL) = (hidden_by IS NULL));

ALTER TABLE "challenges" ADD CHECK (ends_at > starts_at);

ALTER TABLE "challenges" ADD CHECK (target_count > 0);

ALTER TABLE "challenges" ADD CHECK ((hidden_at IS NULL) = (hidden_by IS NULL));

ALTER TABLE "surveys" ADD CHECK (ends_at > starts_at);

ALTER TABLE "surveys" ADD CHECK ((hidden_at IS NULL) = (hidden_by IS NULL));

ALTER TABLE "content_reports" ADD CHECK (reason <> 'other' OR description IS NOT NULL);

ALTER TABLE "content_reports" ADD CHECK ((status = 'pending') = (handled_by IS NULL));

ALTER TABLE "content_reports" ADD CHECK ((handled_at IS NULL) = (handled_by IS NULL));

ALTER TABLE "content_reports" ADD CHECK (status = 'resolved' OR (content_hidden = false AND account_locked = false));

ALTER TABLE "content_reports" ADD CHECK (status <> 'resolved' OR content_hidden OR account_locked);

ALTER TABLE "edition_reports" ADD CHECK ((status = 'pending') = (handled_by IS NULL));

ALTER TABLE "edition_reports" ADD CHECK ((handled_at IS NULL) = (handled_by IS NULL));

ALTER TABLE "revisions" ADD CHECK (revision_number > 0);

ALTER TABLE "revisions" ADD CHECK ((action = 'restore') = (restored_from_id IS NOT NULL));

ALTER TABLE "users" ADD FOREIGN KEY ("locked_by") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "oauth_accounts" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "publishers" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "publishers" ADD FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "publisher_isbn_prefixes" ADD FOREIGN KEY ("publisher_id") REFERENCES "publishers" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "role_permissions" ADD FOREIGN KEY ("role_id") REFERENCES "roles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "role_permissions" ADD FOREIGN KEY ("permission_id") REFERENCES "permissions" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "user_roles" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "user_roles" ADD FOREIGN KEY ("role_id") REFERENCES "roles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "user_roles" ADD FOREIGN KEY ("granted_by") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "works" ADD FOREIGN KEY ("default_edition_id", "id") REFERENCES "editions" ("id", "work_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "works" ADD FOREIGN KEY ("merged_into_id") REFERENCES "works" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "works" ADD FOREIGN KEY ("created_by") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "editions" ADD FOREIGN KEY ("work_id") REFERENCES "works" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "editions" ADD FOREIGN KEY ("managed_by_publisher_id") REFERENCES "publishers" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "editions" ADD FOREIGN KEY ("created_by") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "contributors" ADD FOREIGN KEY ("created_by") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "work_contributors" ADD FOREIGN KEY ("work_id") REFERENCES "works" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "work_contributors" ADD FOREIGN KEY ("contributor_id") REFERENCES "contributors" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "edition_contributors" ADD FOREIGN KEY ("edition_id") REFERENCES "editions" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "edition_contributors" ADD FOREIGN KEY ("contributor_id") REFERENCES "contributors" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "work_genres" ADD FOREIGN KEY ("work_id") REFERENCES "works" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "work_genres" ADD FOREIGN KEY ("genre_id") REFERENCES "genres" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shelf_entries" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shelf_entries" ADD FOREIGN KEY ("edition_id") REFERENCES "editions" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shelf_events" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shelf_events" ADD FOREIGN KEY ("edition_id") REFERENCES "editions" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "work_reviews" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "work_reviews" ADD FOREIGN KEY ("work_id") REFERENCES "works" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "work_reviews" ADD FOREIGN KEY ("hidden_by") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "edition_reviews" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "edition_reviews" ADD FOREIGN KEY ("edition_id") REFERENCES "editions" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "edition_reviews" ADD FOREIGN KEY ("hidden_by") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "challenges" ADD FOREIGN KEY ("publisher_id") REFERENCES "publishers" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "challenges" ADD FOREIGN KEY ("hidden_by") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "challenge_works" ADD FOREIGN KEY ("challenge_id") REFERENCES "challenges" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "challenge_works" ADD FOREIGN KEY ("work_id") REFERENCES "works" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "challenge_participants" ADD FOREIGN KEY ("challenge_id") REFERENCES "challenges" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "challenge_participants" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "challenge_progress" ADD FOREIGN KEY ("participant_id") REFERENCES "challenge_participants" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "challenge_progress" ADD FOREIGN KEY ("work_id") REFERENCES "works" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "surveys" ADD FOREIGN KEY ("publisher_id") REFERENCES "publishers" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "surveys" ADD FOREIGN KEY ("hidden_by") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "survey_options" ADD FOREIGN KEY ("work_id") REFERENCES "works" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "survey_votes" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "survey_questions" ADD FOREIGN KEY ("survey_id") REFERENCES "surveys" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "survey_options" ADD FOREIGN KEY ("question_id") REFERENCES "survey_questions" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "survey_votes" ADD FOREIGN KEY ("option_id", "question_id") REFERENCES "survey_options" ("id", "question_id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "survey_votes" ADD FOREIGN KEY ("question_id", "survey_id") REFERENCES "survey_questions" ("id", "survey_id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "content_reports" ADD FOREIGN KEY ("reporter_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "content_reports" ADD FOREIGN KEY ("handled_by") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "edition_reports" ADD FOREIGN KEY ("reporter_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "edition_reports" ADD FOREIGN KEY ("handled_by") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "edition_reports" ADD FOREIGN KEY ("edition_id") REFERENCES "editions" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "revisions" ADD FOREIGN KEY ("restored_from_id") REFERENCES "revisions" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "revisions" ADD FOREIGN KEY ("changed_by") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

CREATE FUNCTION rebuild_edition_search_text(edition_ids uuid[]) RETURNS void
LANGUAGE sql AS $$
  UPDATE editions e
  SET search_text = f_unaccent(lower(normalize(concat_ws(' ',
        e.title,
        (SELECT string_agg(c.name, ' ')
         FROM edition_contributors ec
         JOIN contributors c ON c.id = ec.contributor_id
         WHERE ec.edition_id = e.id),
        (SELECT string_agg(c.name, ' ')
         FROM work_contributors wc
         JOIN contributors c ON c.id = wc.contributor_id
         WHERE wc.work_id = e.work_id)
      ), NFC)))
  WHERE e.id = ANY(edition_ids);
$$;

COMMENT ON FUNCTION rebuild_edition_search_text(uuid[]) IS 'Xây lại editions.search_text. Tầng ứng dụng gọi trong cùng transaction với thay đổi dữ liệu.';
