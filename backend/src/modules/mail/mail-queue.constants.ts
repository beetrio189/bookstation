export const MAIL_QUEUE = 'mail';

export enum MailJob {
  VERIFY_EMAIL = 'verify-email',
  RESET_PASSWORD = 'reset-password',
  PASSWORD_CHANGED = 'password-changed',
  ACCOUNT_CREDENTIALS = 'account-credentials',
  ACCOUNT_PASSWORD_RESET = 'account-password-reset',
  PUBLISHER_SUSPENDED = 'publisher-suspended',
  PUBLISHER_UNSUSPENDED = 'publisher-unsuspended',
  ACCOUNT_DELETED = 'account-deleted',
  PLAN_UPDATED = 'plan-updated',
  PLAN_UPDATED_NOTICE = 'plan-updated-notice',
  PLAN_DELETED_NOTICE = 'plan-deleted-notice',
  PAYMENT_SETTLE_ALERT = 'payment-settle-alert',
  PAYMENT_RECEIPT = 'payment-receipt',
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
  reason?: string;
}

export interface PublisherStatusJobData extends MailJobData {
  publisherName: string;
  reason: string;
}

export interface AccountDeletedJobData extends MailJobData {
  accountType: AccountType;
}

export interface PlanUpdatedJobData {
  planId: string;
}

export interface PlanSnapshot {
  name: string;
  price: number;
  bookLimit: number;
  editorLimit: number;
}

export interface PlanUpdatedNoticeJobData extends MailJobData {
  plan: PlanSnapshot;
  isFree: boolean;
  oldPlanName?: string;
  periodEndsAt?: string;
}

export interface PlanDeletedNoticeJobData extends MailJobData {
  planName: string;
  periodEndsAt: string;
}

export interface PaymentSettleAlertJobData extends MailJobData {
  failingSince: string;
  failedRuns: number;
  overdueCount: number;
  lastError: string;
}

export interface PaymentReceiptJobData {
  paymentId: string;
}
