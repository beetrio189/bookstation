import type { Metadata } from "next";
import { Geist_Mono, Quicksand } from "next/font/google";
import { SessionRestorer } from "@/components/session-restorer";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Font chính theo Figma
const quicksand = Quicksand({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "BookStation",
    template: "%s | BookStation",
  },
  description: "Nền tảng khám phá và đánh giá sách",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${quicksand.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <SessionRestorer />
        {/* Toast lỗi hệ thống theo component "Toast lỗi" trên Figma */}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
