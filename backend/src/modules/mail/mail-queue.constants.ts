export const MAIL_QUEUE = 'mail';

export enum MailJob {
  VERIFY_EMAIL = 'verify-email',
  RESET_PASSWORD = 'reset-password',
  PASSWORD_CHANGED = 'password-changed',
}

export interface MailJobData {
  userId: string;
  email: string;
}

export interface PasswordChangedJobData extends MailJobData {
  changedAt: string;
}
