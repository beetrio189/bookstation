import {
  signPayment,
  verifyPayment,
  type SignedPaymentFields,
} from '../../../src/modules/subscriptions/payment-signature';
import { PaymentStatus } from '../../../src/utils/enums/payment-status.enum';

describe('payment signature', () => {
  const payment: SignedPaymentFields = {
    id: '0196e2e0-0000-7000-8000-000000000001',
    status: PaymentStatus.SUCCESS,
    price: 600000,
    creditUsed: 100000,
    creditReturned: 0,
    periodStartsAt: new Date('2026-11-21T00:00:00.000Z'),
    periodEndsAt: new Date('2027-05-21T00:00:00.000Z'),
    orderCode: 'BSABCD1234',
  };

  it('produces a 64-char hex HMAC that verifies', () => {
    const signature = signPayment(payment);

    expect(signature).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyPayment({ ...payment, signature })).toBe(true);
  });

  it.each([
    ['price', { price: 1 }],
    ['credit used', { creditUsed: 0 }],
    ['credit returned', { creditReturned: 50000 }],
    ['status', { status: PaymentStatus.FAILED }],
    ['period end', { periodEndsAt: new Date('2028-01-01T00:00:00.000Z') }],
    ['order code', { orderCode: 'BSZZZZ9999' }],
  ])('fails when %s is changed', (_, change) => {
    const signature = signPayment(payment);

    expect(verifyPayment({ ...payment, ...change, signature })).toBe(false);
  });

  it('fails when unsigned or the signature is malformed', () => {
    expect(verifyPayment({ ...payment, signature: null })).toBe(false);
    expect(verifyPayment({ ...payment, signature: 'abc' })).toBe(false);
  });
});
