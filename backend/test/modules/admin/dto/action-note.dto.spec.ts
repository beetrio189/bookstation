import { ValidationPipe } from '@nestjs/common';
import { validationExceptionFactory } from '../../../../src/utils/errors/validation-exception.factory';
import { ActionNoteDto } from '../../../../src/modules/admin/dto/action-note.dto';
import { CreateModeratorDto } from '../../../../src/modules/admin/dto/create-moderator.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  exceptionFactory: validationExceptionFactory,
});
const validate = (metatype: new () => object, value: unknown) =>
  pipe.transform(value, { type: 'body', metatype });

describe('ActionNoteDto', () => {
  it.each([
    ['missing', {}, ''],
    ['empty', { note: '' }, ''],
    ['padded', { note: '  Nghỉ việc  ' }, 'Nghỉ việc'],
  ])('accepts a %s note', async (_label, body, note) => {
    await expect(validate(ActionNoteDto, body)).resolves.toEqual({ note });
  });

  it('treats a request without a body (DELETE) as an empty note', async () => {
    await expect(validate(ActionNoteDto, undefined)).resolves.toMatchObject({
      note: '',
    });
  });

  it.each([
    ['not a string', { note: 123 }],
    ['too long', { note: 'a'.repeat(1001) }],
  ])('rejects a note that is %s', async (_label, body) => {
    await expect(validate(ActionNoteDto, body)).rejects.toMatchObject({
      status: 400,
    });
  });

  it('is part of the create moderator body', async () => {
    await expect(
      validate(CreateModeratorDto, { email: 'kdv@bookstation.vn', name: 'A' }),
    ).resolves.toEqual({ email: 'kdv@bookstation.vn', name: 'A', note: '' });
  });
});
