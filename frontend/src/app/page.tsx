import { Button } from "@/components/ui/button";

// Trang tạm để kiểm tra project chạy, thay bằng trang chủ theo Figma sau
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold">BookStation</h1>
      <p className="text-muted-foreground">Nền tảng khám phá và đánh giá sách</p>
      <Button>Bắt đầu</Button>
    </main>
  );
}
