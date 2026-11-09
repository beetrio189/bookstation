import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    PORT: z.coerce.number().default(8080),
    FE_URL: z.url(),
    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),
    JWT_SECRET: z.string().min(32),
    RESEND_API_KEY: z.string().optional(),
    MAIL_FROM: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    GOOGLE_REDIRECT_URI: z.url().optional(),
  })
  .superRefine((value, context) => {
    if (value.RESEND_API_KEY && !value.MAIL_FROM) {
      context.addIssue({
        code: 'custom',
        path: ['MAIL_FROM'],
        message: 'Required when RESEND_API_KEY is set',
      });
    }

    if (value.NODE_ENV === 'production' && !value.RESEND_API_KEY) {
      context.addIssue({
        code: 'custom',
        path: ['RESEND_API_KEY'],
        message: 'Required in production',
      });
    }

    if (value.NODE_ENV === 'production' && !value.GOOGLE_REDIRECT_URI) {
      context.addIssue({
        code: 'custom',
        path: ['GOOGLE_REDIRECT_URI'],
        message: 'Required in production',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Config validation error: ${parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ')}`,
  );
}

export const env = {
  nodeEnv: parsed.data.NODE_ENV,
  port: parsed.data.PORT,
  feUrl: parsed.data.FE_URL,
  databaseUrl: parsed.data.DATABASE_URL,
  redisUrl: parsed.data.REDIS_URL,
  jwtSecret: parsed.data.JWT_SECRET,
  resendApiKey: parsed.data.RESEND_API_KEY,
  mailFrom: parsed.data.MAIL_FROM,
  googleClientId: parsed.data.GOOGLE_CLIENT_ID,
  googleClientSecret: parsed.data.GOOGLE_CLIENT_SECRET,
  googleRedirectUri:
    parsed.data.GOOGLE_REDIRECT_URI ??
    `http://localhost:${parsed.data.PORT}/api/auth/google/callback`,
};
