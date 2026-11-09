import Image from "next/image";
import type { CSSProperties } from "react";

// Figma dựng ở khung 1920x1080. --u = 1px của Figma, co giãn theo chiều cao
// màn hình nên phần tranh luôn vừa khít chiều cao.
const u = (px: number) => `calc(var(--u) * ${px})`;

const box = (left: number, top: number, width: number, height: number) =>
  ({
    left: u(left),
    top: u(top),
    width: u(width),
    height: u(height),
  }) satisfies CSSProperties;

function Cover({
  src,
  style,
  className,
}: {
  src: string;
  style: CSSProperties;
  className: string;
}) {
  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{ ...style, borderRadius: u(20) }}
    >
      <Image src={src} alt="" fill sizes="30vw" className="object-cover" />
    </div>
  );
}

// Tranh trang trí bên trái trang đăng nhập/đăng ký, chỉ hiện khi màn hình rộng
export function AuthArtwork() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 hidden select-none wide:block"
    >
      <div
        className="absolute flex items-center justify-center"
        style={box(460.39, 418, 605.23, 753.01)}
      >
        <Cover
          src="/images/auth/cover-utopia.png"
          className="relative rotate-15 shadow-[0_0_20px_0_rgba(0,0,0,0.5)]"
          style={{ width: u(450), height: u(659) }}
        />
      </div>
      <div
        className="absolute flex items-center justify-center"
        style={box(-180, 424, 605.23, 753.01)}
      >
        <Cover
          src="/images/auth/cover-so-do.jpg"
          className="relative -rotate-15 shadow-[0_0_20px_0_rgba(0,0,0,0.5)]"
          style={{ width: u(450), height: u(659) }}
        />
      </div>
      <Cover
        src="/images/auth/cover-viec-lang.jpg"
        className="absolute shadow-[0_10px_20px_0_rgba(0,0,0,0.5)]"
        style={box(146, 282, 558, 817)}
      />
      <div className="absolute" style={box(274, 0, 1646, 1080)}>
        <div className="absolute inset-[-1.85%_-0.91%_-1.85%_-1.52%]">
          <Image src="/images/auth/blob.svg" alt="" fill priority />
        </div>
      </div>
      {/* Màn hình rộng hơn 16:9 thì phần bên phải khối trắng vẫn là nền trắng */}
      <div
        className="absolute inset-y-0 right-0 bg-background"
        style={{ left: u(1915) }}
      />
    </div>
  );
}
