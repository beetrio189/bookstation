export const MAINTENANCE_QUEUE = 'maintenance';

export enum MaintenanceJob {
  DELETE_EXPIRED_REFRESH_TOKENS = 'delete-expired-refresh-tokens',
  SETTLE_EXPIRED_PAYMENTS = 'settle-expired-payments',
}
