import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Logo } from "@/components/logo";
import { ReaderHeader } from "@/components/reader/reader-header";
import { guardArea } from "@/lib/session";

// Khu độc giả: khách cũng vào được; role khác về khu của mình
export const Route = createFileRoute("/_reader")({
  beforeLoad: () => guardArea("reader"),
  component: ReaderLayout,
});

function ReaderLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <ReaderHeader />
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
      <ReaderFooter />
    </div>
  );
}

// Các trang trong footer chưa có thì tạm để chữ; "Dành cho nhà xuất bản" mở trang gói công khai
function ReaderFooter() {
  return (
    <footer className="mt-12 bg-white md:mt-20">
      <div className="mx-auto flex max-w-480 flex-col gap-6 px-4 py-6 md:px-10 md:py-12 2xl:px-25">
        <div className="flex flex-col justify-between gap-6 md:flex-row">
          <div className="hidden max-w-110 flex-col gap-4 md:flex">
            <Logo textClassName="text-[26px]" />
            <p className="text-lg font-medium">
              BookStation – nơi độc giả tìm sách, đọc và viết đánh giá, tham gia
              khảo sát của các nhà xuất bản.
            </p>
          </div>
          <div className="flex flex-col gap-2 md:gap-4">
            <p className="hidden text-xl font-medium text-foreground/50 md:block">
              Liên kết
            </p>
            <ul className="flex gap-4 text-sm font-semibold md:flex-col md:text-lg md:font-medium">
              <li>Giới thiệu</li>
              <li>Liên hệ</li>
              <li>
                <Link to="/plans" className="hover:underline">
                  Dành cho nhà xuất bản
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="flex justify-between gap-4 text-xs font-medium text-foreground/60 md:text-[15px]">
          <p>© 2026 BookStation. Đồ án HUST.</p>
          <p className="hidden gap-10 md:flex">
            <span>Điều khoản</span>
            <span>Quyền riêng tư</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
