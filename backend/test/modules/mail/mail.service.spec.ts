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

  it('puts the escaped reason at the end of a reset email', async () => {
    env.resendApiKey = 're_test';
    send.mockResolvedValue({ data: { id: '1' }, error: null });

    await new MailService().sendAccountPasswordResetEmail(
      'nxb@example.com',
      'publisher',
      'Ab3$xyz-Pq9!kLm2',
      'NXB báo <không> nhận được mail',
    );

    const [{ html }] = send.mock.calls[0] as [{ html: string }];

    expect(html).toContain('tài khoản nhà xuất bản BookStation');
    expect(html.trim()).toMatch(
      /<p>Lý do: NXB báo &lt;không&gt; nhận được mail<\/p>$/,
    );
  });

  it('has no reason line when there is no reason', async () => {
    env.resendApiKey = 're_test';
    send.mockResolvedValue({ data: { id: '1' }, error: null });

    await new MailService().sendAccountPasswordResetEmail(
      'bt@example.com',
      'editor',
      'Ab3$xyz-Pq9!kLm2',
    );

    const [{ html }] = send.mock.calls[0] as [{ html: string }];

    expect(html).toContain('tài khoản biên tập viên BookStation');
    expect(html).not.toContain('Lý do');
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

  it('tells a publisher it was suspended, with the escaped name and reason at the end', async () => {
    env.resendApiKey = 're_test';
    send.mockResolvedValue({ data: { id: '1' }, error: null });

    await new MailService().sendPublisherSuspendedEmail(
      'nxb@example.com',
      'NXB <Kim Đồng>',
      'Tài khoản bị chiếm & có biên tập viên lạ',
    );

    const [{ to, subject, html }] = send.mock.calls[0] as [
      { to: string; subject: string; html: string },
    ];

    expect(to).toBe('nxb@example.com');
    expect(subject).toBe(
      'Nhà xuất bản của bạn đã bị đình chỉ trên BookStation',
    );
    expect(html).toContain('<b>NXB &lt;Kim Đồng&gt;</b> đã bị đình chỉ');
    expect(html.trim()).toMatch(
      /<p>Lý do: Tài khoản bị chiếm &amp; có biên tập viên lạ<\/p>$/,
    );
  });

  it('tells a publisher it was unsuspended, with a login link and the reason', async () => {
    env.resendApiKey = 're_test';
    send.mockResolvedValue({ data: { id: '1' }, error: null });

    await new MailService().sendPublisherUnsuspendedEmail(
      'nxb@example.com',
      'Kim Đồng',
      'Đã xác minh',
    );

    const [{ subject, html }] = send.mock.calls[0] as [
      { subject: string; html: string },
    ];

    expect(subject).toBe(
      'Nhà xuất bản của bạn đã được mở khóa trên BookStation',
    );
    expect(html).toContain('href="http://localhost:3000/login"');
    expect(html.trim()).toMatch(/<p>Lý do: Đã xác minh<\/p>$/);
  });

  it('tells a moderator the account was deleted, without a reason', async () => {
    env.resendApiKey = 're_test';
    send.mockResolvedValue({ data: { id: '1' }, error: null });

    await new MailService().sendAccountDeletedEmail(
      'kdv@example.com',
      'moderator',
    );

    const [{ to, subject, html }] = send.mock.calls[0] as [
      { to: string; subject: string; html: string },
    ];

    expect(to).toBe('kdv@example.com');
    expect(subject).toBe(
      'Tài khoản kiểm duyệt viên BookStation của bạn đã bị xóa',
    );
    expect(html).toContain('<b>kdv@example.com</b> đã bị quản trị viên xóa');
    expect(html).not.toContain('Lý do');
  });

  describe('plan emails', () => {
    const PLAN = {
      name: 'Basic <Plus>',
      price: 600000,
      bookLimit: 100000,
      editorLimit: 2,
    };
    const sentHtml = () =>
      (send.mock.calls[0] as [{ subject: string; html: string }])[0];

    beforeEach(() => {
      env.resendApiKey = 're_test';
      send.mockResolvedValue({ data: { id: '1' }, error: null });
    });

    it('tells a subscriber the plan was changed, with escaped names, limits, price, and the end of the period', async () => {
      await new MailService().sendPlanUpdatedEmail('nxb@example.com', PLAN, {
        planName: 'basic & co',
        periodEndsAt: new Date('2027-05-01T05:00:00.000Z'),
      });

      const { subject, html } = sentHtml();

      expect(subject).toBe('Gói hội viên BookStation đã được thay đổi');
      expect(html).toContain('Gói <b>basic &amp; co</b>');
      expect(html).toContain(
        'đã được thay đổi thành gói <b>Basic &lt;Plus&gt;</b>',
      );
      expect(html).toContain(
        '100.000 cuốn sách, 2 biên tập viên, giá 600.000 đ',
      );
      expect(html).toContain('đến hết kỳ (ngày 1/5/2027)');
      expect(html).not.toContain('đổi tên');
    });

    it('tells a Free publisher the new limits, priced as free', async () => {
      await new MailService().sendPlanUpdatedEmail('nxb@example.com', {
        ...PLAN,
        name: 'Free',
        price: 0,
      });

      const { html } = sentHtml();

      expect(html).toContain('Chúng tôi vừa thay đổi gói <b>Free</b>');
      expect(html).toContain('giá miễn phí');
      expect(html).not.toContain('hết kỳ');
    });

    it('tells a subscriber the plan was deleted, keeping the limits until the end of the period', async () => {
      await new MailService().sendPlanDeletedEmail(
        'nxb@example.com',
        'Pro <x>',
        new Date('2027-05-01T05:00:00.000Z'),
      );

      const { subject, html } = sentHtml();

      expect(subject).toBe(
        'Gói hội viên BookStation của bạn đã ngừng cung cấp',
      );
      expect(html).toContain('Gói <b>Pro &lt;x&gt;</b>');
      expect(html).toContain('đến hết kỳ (ngày 1/5/2027)');
    });
  });
});
