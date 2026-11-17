# BookStation frontend

React 19 + Vite + TanStack Router (route theo thư mục `src/routes`), Tailwind CSS 4, shadcn/ui.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # kiểm tra kiểu rồi build ra dist/
npm run lint
```

- `.env.local`: `VITE_API_URL` (mặc định `http://localhost:8080/api`), gắn cứng vào JS lúc build.
- Route: mỗi file trong `src/routes` là một trang; file bắt đầu bằng `-` là component riêng của trang, không phải route. `src/routeTree.gen.ts` do plugin tự sinh, đừng sửa tay.
- Khu theo role: `/admin` (admin, kiểm duyệt viên), `/publisher` (NXB, biên tập viên), còn lại là trang độc giả. Chặn trong `beforeLoad` bằng `guardArea()` (`src/lib/session.ts`).
