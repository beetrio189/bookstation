# BookStation Backend

NestJS, TypeORM, PostgreSQL.

## Chạy local

```bash
cp .env.example .env
docker compose up -d
npm install
npm run migration:run
npm run start:dev
```

- API: http://localhost:8080/api
- Health check: http://localhost:8080/api/health
- Swagger (ngoài production): http://localhost:8080/docs

## Format response

Mỗi response có `data` hoặc `error`, không có cả hai.

```json
{ "data": { "id": "uuid", "displayName": "Wing" } }
{ "data": { "items": [{ "id": "uuid" }] } }
{ "error": { "code": 2000, "message": "Email này đã được sử dụng" } }
```

- `data` luôn là object. Controller trả mảng thì mảng nằm trong `items`, không trả gì thì `data` là `{}`.
- Trường có giá trị `null` bị bỏ khỏi response.
- `error.code` được định nghĩa trong `src/utils/errors/errors.ts`, không phụ thuộc HTTP status. Trong code dùng theo tên, ví dụ `new AppException(ERRORS.EMAIL_ALREADY_EXISTS)`.
- Lỗi validate chỉ báo trường sai đầu tiên. Mỗi validator trong DTO phải có `message` tiếng Việt.
- API danh sách nhận `page` và `limit`, response không trả thông tin phân trang.

## Migration

Schema chỉ thay đổi qua migration viết tay, `synchronize` luôn tắt.

```bash
npm run migration:show
npm run migration:create -- src/database/migrations/TenMigration
npm run migration:run
npm run migration:revert
```

Sau khi viết SQL trong migration, tự cập nhật entity cho khớp.

Không dùng `typeorm migration:generate`. Schema được tạo bằng SQL viết tay nên lệnh này sẽ sinh thêm các lệnh xóa FK, CHECK, index và comment.
