export const MAIL_QUEUE = 'mail';

export enum MailJob {
  VERIFY_EMAIL = 'verify-email',
}

export interface VerifyEmailJobData {
  userId: string;
  email: string;
}
