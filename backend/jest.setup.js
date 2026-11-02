// Giá trị giả để test không bao giờ dùng service thật trong file .env
Object.assign(process.env, {
  NODE_ENV: 'test',
  FE_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'test-secret-that-is-at-least-32-chars',
  RESEND_API_KEY: '',
  MAIL_FROM: 'BookStation <no-reply@example.com>',
});
