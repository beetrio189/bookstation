import { ValidationPipe } from '@nestjs/common';
import { validationExceptionFactory } from '../../../../src/utils/errors/validation-exception.factory';
import { CreatePublisherDto } from '../../../../src/modules/admin/dto/create-publisher.dto';
import { ListPublishersQuery } from '../../../../src/modules/admin/dto/list-publishers.query';
import { RequiredNoteDto } from '../../../../src/modules/admin/dto/required-note.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  exceptionFactory: validationExceptionFactory,
});
const body = (metatype: new () => object, value: unknown) =>
  pipe.transform(value, { type: 'body', metatype });
const query = (value: object) =>
  pipe.transform(value, { type: 'query', metatype: ListPublishersQuery });
const VALID = {
  email: 'nxb@example.com',
  publisherName: 'Kim Đồng',
  note: 'Đơn ngày 17/11',
};

describe('publisher DTOs', () => {
  it('normalizes the email, trims, and drops unknown fields', async () => {
    await expect(
      body(CreatePublisherDto, {
        email: ' NXB@Example.com ',
        publisherName: '  Kim Đồng ',
        note: ' Đơn ngày 17/11 ',
        subscriptionTier: 'pro',
      }),
    ).resolves.toEqual(VALID);
  });

  it.each([
    ['no note', { ...VALID, note: undefined }],
    ['a blank note', { ...VALID, note: '   ' }],
    ['a blank name', { ...VALID, publisherName: ' ' }],
    [
      'a name over 255 characters',
      { ...VALID, publisherName: 'a'.repeat(256) },
    ],
  ])('rejects %s', async (_label, value) => {
    await expect(body(CreatePublisherDto, value)).rejects.toMatchObject({
      status: 400,
    });
  });

  it('requires a note for the other publisher/editor actions', async () => {
    await expect(body(RequiredNoteDto, {})).rejects.toMatchObject({
      status: 400,
    });
    await expect(body(RequiredNoteDto, { note: ' x ' })).resolves.toEqual({
      note: 'x',
    });
  });

  it('defaults page 1, limit 20, no keyword', async () => {
    await expect(query({})).resolves.toEqual({ page: 1, limit: 20, q: '' });
  });

  it('reads numbers from the query string and trims the keyword', async () => {
    await expect(
      query({ page: '3', limit: '50', q: '  kim dong ' }),
    ).resolves.toEqual({ page: 3, limit: 50, q: 'kim dong' });
  });

  it.each([
    { page: '0' },
    { page: '1.5' },
    { limit: '0' },
    { limit: '101' },
    { limit: 'abc' },
    { q: 'a'.repeat(101) },
  ])('rejects %o instead of clamping it', async (value) => {
    await expect(query(value)).rejects.toMatchObject({ status: 400 });
  });
});
