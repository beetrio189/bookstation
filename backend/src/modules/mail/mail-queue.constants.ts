export const MAIL_QUEUE = 'mail';

export enum MailJob {
  VERIFY_EMAIL = 'verify-email',
  RESET_PASSWORD = 'reset-password',
  PASSWORD_CHANGED = 'password-changed',
  ACCOUNT_CREDENTIALS = 'account-credentials',
  ACCOUNT_PASSWORD_RESET = 'account-password-reset',
  PUBLISHER_SUSPENDED = 'publisher-suspended',
  PUBLISHER_UNSUSPENDED = 'publisher-unsuspended',
  // Báo tài khoản (kiểm duyệt viên) đã bị admin xóa; user không còn trong DB nên job mang sẵn email
  ACCOUNT_DELETED = 'account-deleted',
}

export type AccountType = 'publisher' | 'editor' | 'moderator';

export interface MailJobData {
  userId: string;
  email: string;
}

export interface PasswordChangedJobData extends MailJobData {
  changedAt: string;
}

export interface AccountCredentialsJobData extends MailJobData {
  accountType: AccountType;
  // Lý do đặt lại mật khẩu (ghi chú của admin/KDV), in ở cuối email
  reason?: string;
}

// Báo NXB bị đình chỉ / được mở khóa, kèm lý do do admin/KDV nhập
export interface PublisherStatusJobData extends MailJobData {
  publisherName: string;
  reason: string;
}

export interface AccountDeletedJobData extends MailJobData {
  accountType: AccountType;
}
