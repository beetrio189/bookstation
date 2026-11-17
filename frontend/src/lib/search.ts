// TanStack Router tự JSON.parse giá trị trên URL (?error=2003 thành số 2003):
// đọc lại thành chuỗi cho các tham số luôn là chuỗi (uid, token, mã lỗi)
export const searchString = (value: unknown): string | undefined =>
  value === undefined || value === null || value === "" ? undefined : String(value);
