// Access token chỉ nằm trong bộ nhớ (không localStorage) để script lạ không đọc
// được. F5 là mất, khi đó FE gọi /auth/refresh bằng cookie để lấy lại.
let accessToken: string | null = null;

export const getAccessToken = () => accessToken;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};
