// Vite gắn cứng VITE_* vào JS lúc build (đọc từ .env / .env.local)
export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  "http://localhost:8080/api";
