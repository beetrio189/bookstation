import { ValidationPipe } from '@nestjs/common';
import { CreatePlanDto } from '../../../../src/modules/admin/dto/create-plan.dto';
import { validationExceptionFactory } from '../../../../src/utils/errors/validation-exception.factory';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  exceptionFactory: validationExceptionFactory,
});
const body = (value: unknown) =>
  pipe.transform(value, { type: 'body', metatype: CreatePlanDto });
const VALID = {
  name: 'basic',
  durationMonths: 6,
  description: 'Cho NXB nhỏ',
  price: 500000,
  bookLimit: 100000,
  editorLimit: 2,
  note: '',
};

describe('CreatePlanDto', () => {
  it('trims and lowercases the name, trims text, and drops unknown fields', async () => {
    await expect(
      body({
        ...VALID,
        name: '  Basic ',
        description: ' Cho NXB nhỏ ',
        isActive: false,
      }),
    ).resolves.toEqual(VALID);
  });

  it('accepts a plan without description, note, and with zero limits', async () => {
    const rest = {
      name: 'basic',
      durationMonths: 6,
      price: 500000,
    };

    await expect(
      body({ ...rest, bookLimit: 0, editorLimit: 0 }),
    ).resolves.toMatchObject({ ...rest, bookLimit: 0, editorLimit: 0 });
  });

  it.each([6, 12, 24])('accepts %i months', async (durationMonths) => {
    await expect(body({ ...VALID, durationMonths })).resolves.toMatchObject({
      durationMonths,
    });
  });

  it.each([
    ['the free plan name', { name: ' None ' }],
    ['a name with spaces', { name: 'gói cơ bản' }],
    ['a blank name', { name: '  ' }],
    ['a name over 50 characters', { name: 'a'.repeat(51) }],
    ['0 months', { durationMonths: 0 }],
    ['3 months (not 6, 12 or 24)', { durationMonths: 3 }],
    ['36 months', { durationMonths: 36 }],
    ['months as a string', { durationMonths: '6' }],
    ['missing months', { durationMonths: undefined }],
    ['a free paid plan', { price: 0 }],
    ['a price over 2 billion', { price: 2_000_000_001 }],
    ['a negative book limit', { bookLimit: -1 }],
    ['an editor limit over 2 billion', { editorLimit: 2_000_000_001 }],
    ['a description over 1000 characters', { description: 'a'.repeat(1001) }],
    ['a missing price', { price: undefined }],
  ])('rejects %s', async (_label, change) => {
    await expect(body({ ...VALID, ...change })).rejects.toMatchObject({
      status: 400,
    });
  });
});
