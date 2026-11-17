// Trang chưa làm: tiêu đề + khung nét đứt như Figma "Khung quản trị"
export function PagePlaceholder({ title }: { title: string }) {
  return (
    <>
      <h1 className="mt-7 mb-7 text-[32px] font-bold">{title}</h1>
      <div className="flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-foreground/35 bg-white/50 text-xl font-medium text-foreground/50">
        Đang phát triển
      </div>
    </>
  );
}
