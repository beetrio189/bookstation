import { Logger } from '@nestjs/common';
import { env } from '../../config';
import { MailService } from './mail.service';

const send = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn(() => ({ emails: { send } })),
}));

describe('MailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    env.resendApiKey = '';
  });

  it('logs the link instead of sending when there is no API key', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    await new MailService().sendVerificationEmail('a@example.com', 'abc-123');

    expect(send).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      'Email to a@example.com: http://localhost:3000/verify-email?token=abc-123',
    );
  });

  it('sends through Resend when there is an API key', async () => {
    env.resendApiKey = 're_test';
    send.mockResolvedValue({ data: { id: '1' }, error: null });

    await new MailService().sendVerificationEmail('a@example.com', 'abc-123');

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: env.mailFrom,
        to: 'a@example.com',
        html: expect.stringContaining(
          'http://localhost:3000/verify-email?token=abc-123',
        ) as string,
      }),
    );
  });

  it('throws when Resend reports an error', async () => {
    env.resendApiKey = 're_test';
    send.mockResolvedValue({ data: null, error: { message: 'bad domain' } });

    await expect(
      new MailService().sendVerificationEmail('a@example.com', 'abc-123'),
    ).rejects.toThrow('Resend: bad domain');
  });
});
