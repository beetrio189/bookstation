export const MAIL_QUEUE = 'mail';

export enum MailJob {
  VERIFY_EMAIL = 'verify-email',
  RESET_PASSWORD = 'reset-password',
  PASSWORD_CHANGED = 'password-changed',
  ACCOUNT_CREDENTIALS = 'account-credentials',
  ACCOUNT_PASSWORD_RESET = 'account-password-reset',
}

export type AccountType = 'publisher' | 'moderator';

export interface MailJobData {
  userId: string;
  email: string;
}

export interface PasswordChangedJobData extends MailJobData {
  changedAt: string;
}

export interface AccountCredentialsJobData extends MailJobData {
  accountType: AccountType;
}
