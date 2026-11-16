import { Logger } from '@nestjs/common';
import { env } from '../../../src/config';
import { MailService } from '../../../src/modules/mail/mail.service';

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

    await new MailService().sendVerificationEmail(
      'a@example.com',
      'user-1',
      'abc-123',
    );

    expect(send).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      'Email to a@example.com: http://localhost:3000/verify-email?uid=user-1&token=abc-123',
    );
  });

  it('links the verification email to the forgot password page', async () => {
    env.resendApiKey = 're_test';
    send.mockResolvedValue({ data: { id: '1' }, error: null });

    await new MailService().sendVerificationEmail(
      'a@example.com',
      'user-1',
      'abc-123',
    );

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining(
          'href="http://localhost:3000/forgot-password"',
        ) as string,
      }),
    );
  });

  it('tells the time of a password change in Vietnam time', async () => {
    env.resendApiKey = 're_test';
    send.mockResolvedValue({ data: { id: '1' }, error: null });

    await new MailService().sendPasswordChangedEmail(
      'a@example.com',
      new Date('2026-11-14T03:05:00.000Z'),
    );

    const [{ html }] = send.mock.calls[0] as [{ html: string }];

    expect(html).toContain('10:05');
    expect(html).toContain('14/11/2026');
    expect(html).toContain('href="http://localhost:3000/forgot-password"');
  });

  it('links a password reset email to the reset page', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    await new MailService().sendPasswordResetEmail(
      'a@example.com',
      'user-1',
      'abc-123',
    );

    expect(log).toHaveBeenCalledWith(
      'Email to a@example.com: http://localhost:3000/reset-password?uid=user-1&token=abc-123',
    );
  });

  it('sends through Resend when there is an API key', async () => {
    env.resendApiKey = 're_test';
    send.mockResolvedValue({ data: { id: '1' }, error: null });

    await new MailService().sendVerificationEmail(
      'a@example.com',
      'user-1',
      'abc-123',
    );

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: env.mailFrom,
        to: 'a@example.com',
        html: expect.stringContaining(
          'http://localhost:3000/verify-email?uid=user-1&token=abc-123',
        ) as string,
      }),
    );
  });

  it.each([
    ['publisher', 'nhà xuất bản'],
    ['moderator', 'kiểm duyệt viên'],
  ] as const)(
    'emails the login and password of a new %s account',
    async (accountType, label) => {
      env.resendApiKey = 're_test';
      send.mockResolvedValue({ data: { id: '1' }, error: null });

      await new MailService().sendAccountCredentialsEmail(
        'nxb@example.com',
        accountType,
        'Ab3$xyz-Pq9!kLm2',
      );

      const [{ to, html }] = send.mock.calls[0] as [
        { to: string; html: string },
      ];

      expect(to).toBe('nxb@example.com');
      expect(html).toContain(`Tài khoản ${label} BookStation`);
      expect(html).toContain('Email đăng nhập: <b>nxb@example.com</b>');
      expect(html).toContain('Mật khẩu: <b>Ab3$xyz-Pq9!kLm2</b>');
      expect(html).toContain('href="http://localhost:3000/login"');
      expect(html).toContain('đổi mật khẩu ngay');
    },
  );

  it('emails the new password after an admin reset, with reset wording', async () => {
    env.resendApiKey = 're_test';
    send.mockResolvedValue({ data: { id: '1' }, error: null });

    await new MailService().sendAccountPasswordResetEmail(
      'kdv@example.com',
      'moderator',
      'Ab3$xyz-Pq9!kLm2',
    );

    const [{ to, subject, html }] = send.mock.calls[0] as [
      { to: string; subject: string; html: string },
    ];

    expect(to).toBe('kdv@example.com');
    expect(subject).toBe('Mật khẩu BookStation của bạn đã được đặt lại');
    expect(html).toContain(
      'Mật khẩu tài khoản kiểm duyệt viên BookStation của bạn đã được đặt lại',
    );
    expect(html).not.toContain('đã được tạo');
    expect(html).toContain('Email đăng nhập: <b>kdv@example.com</b>');
    expect(html).toContain('Mật khẩu: <b>Ab3$xyz-Pq9!kLm2</b>');
    expect(html).toContain('href="http://localhost:3000/login"');
  });

  it('escapes HTML in the credentials email', async () => {
    env.resendApiKey = 're_test';
    send.mockResolvedValue({ data: { id: '1' }, error: null });

    await new MailService().sendAccountCredentialsEmail(
      'a@example.com',
      'publisher',
      '<b>&"',
    );

    const [{ html }] = send.mock.calls[0] as [{ html: string }];

    expect(html).toContain('Mật khẩu: <b>&lt;b&gt;&amp;&quot;</b>');
  });

  it('throws when Resend reports an error', async () => {
    env.resendApiKey = 're_test';
    send.mockResolvedValue({ data: null, error: { message: 'bad domain' } });

    await expect(
      new MailService().sendVerificationEmail(
        'a@example.com',
        'user-1',
        'abc-123',
      ),
    ).rejects.toThrow('Resend: bad domain');
  });
});
