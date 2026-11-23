import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MailService } from '../../src/modules/mail/mail.service';
import { PaymentStatus } from '../../src/utils/enums/payment-status.enum';
import { PaymentReceiptService } from '../../src/worker/payment-receipt.service';

describe('PaymentReceiptService', () => {
  const dataSource = { query: jest.fn() };
  const mailService = { sendPaymentReceiptEmail: jest.fn() };
  const service = new PaymentReceiptService(
    dataSource as unknown as DataSource,
    mailService as unknown as MailService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  it('reads the success order again and mails the owner of the publisher', async () => {
    const receipt = { orderCode: 'BSABCD1234', price: 600000, creditUsed: 0 };
    dataSource.query.mockResolvedValue([
      { email: 'owner@example.com', ...receipt },
    ]);

    await service.send('pay-1');

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('JOIN users u ON u.id = p.user_id'),
      ['pay-1', PaymentStatus.SUCCESS],
    );
    expect(mailService.sendPaymentReceiptEmail).toHaveBeenCalledWith(
      'owner@example.com',
      receipt,
    );
  });

  it('skips when the order or the publisher no longer exists', async () => {
    dataSource.query.mockResolvedValue([]);

    await service.send('pay-1');

    expect(mailService.sendPaymentReceiptEmail).not.toHaveBeenCalled();
  });
});
