import { createHmac } from 'node:crypto';
import {
  buildCheckoutForm,
  generateOrderCode,
} from '../../../src/modules/subscriptions/sepay-checkout';

describe('SePay checkout', () => {
  it.each(['BS', 'CR'] as const)(
    'generates %s + 8 chars of [0-9A-Z]',
    (prefix) => {
      for (let i = 0; i < 50; i++) {
        expect(generateOrderCode(prefix)).toMatch(
          new RegExp(`^${prefix}[0-9A-Z]{8}$`),
        );
      }
    },
  );

  it('builds a sandbox form signed in field order, signature last', () => {
    const form = buildCheckoutForm({
      orderCode: 'BSABCD1234',
      amount: 10000,
      description: 'Thanh toán đơn hàng BSABCD1234',
      successUrl: 'http://fe/s',
      errorUrl: 'http://fe/e',
      cancelUrl: 'http://fe/c',
    });

    expect(form.action).toBe('https://pay-sandbox.sepay.vn/v1/checkout/init');
    expect(Object.keys(form.fields)).toEqual([
      'merchant',
      'currency',
      'order_amount',
      'operation',
      'order_description',
      'order_invoice_number',
      'success_url',
      'error_url',
      'cancel_url',
      'signature',
    ]);
    expect(form.fields).toMatchObject({
      merchant: 'test-merchant',
      order_amount: '10000',
      operation: 'PURCHASE',
    });

    const { signature, ...signed } = form.fields;
    const expected = createHmac('sha256', 'test-sepay-secret')
      .update(
        Object.entries(signed)
          .map(([name, value]) => `${name}=${value}`)
          .join(','),
      )
      .digest('base64');
    expect(signature).toBe(expected);
  });
});
