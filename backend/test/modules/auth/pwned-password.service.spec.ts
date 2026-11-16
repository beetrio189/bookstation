import { createHash } from 'crypto';
import { Logger } from '@nestjs/common';
import { PwnedPasswordService } from '../../../src/modules/auth/pwned-password.service';

const PASSWORD = 'MatKhau123';
const HASH = createHash('sha1').update(PASSWORD).digest('hex').toUpperCase();
const PREFIX = HASH.slice(0, 5);
const SUFFIX = HASH.slice(5);

// Response dạng HIBP: "SUFFIX:COUNT" mỗi dòng, xuống dòng CRLF
const rangeBody = (count: number | null) =>
  [
    '0018A45C4D1DEF81644B54AB7F969B88D65:3',
    ...(count === null ? [] : [`${SUFFIX}:${count}`]),
    '00D4F6E8FA6EECAD2A3AA415EEC418D38EC:0',
  ].join('\r\n');

describe('PwnedPasswordService', () => {
  const service = new PwnedPasswordService();
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = fetchMock;
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  const respond = (body: string, status = 200) =>
    fetchMock.mockResolvedValue(new Response(body, { status }));

  it('sends only the first 5 characters of the SHA-1 hash', async () => {
    respond(rangeBody(null));

    await service.assertNotPwned(PASSWORD);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe(`https://api.pwnedpasswords.com/range/${PREFIX}`);
    expect(url).not.toContain(SUFFIX);
    expect(init.headers).toMatchObject({ 'Add-Padding': 'true' });
  });

  it.each([null, 0, 10])('allows a password seen %s times', async (count) => {
    respond(rangeBody(count));

    await expect(service.assertNotPwned(PASSWORD)).resolves.toBeUndefined();
  });

  it('rejects a password seen more than 10 times with the exact count', async () => {
    respond(rangeBody(12345));

    await expect(service.assertNotPwned(PASSWORD)).rejects.toMatchObject({
      code: 2009,
      message:
        'Mật khẩu này đã xuất hiện 12.345 lần trong các vụ rò rỉ dữ liệu (theo HaveIBeenPwned), vui lòng chọn mật khẩu khác',
    });
  });

  it('rejects at 11 times', async () => {
    respond(rangeBody(11));

    await expect(service.assertNotPwned(PASSWORD)).rejects.toMatchObject({
      code: 2009,
    });
  });

  it.each([
    ['an HTTP error', () => respond('', 503)],
    [
      'a network error or timeout',
      () => fetchMock.mockRejectedValue(new Error('timeout')),
    ],
  ])('lets the password through on %s and logs a warning', async (_, setup) => {
    setup();

    await expect(service.assertNotPwned(PASSWORD)).resolves.toBeUndefined();
    expect(Logger.prototype.warn).toHaveBeenCalled();
  });
});
