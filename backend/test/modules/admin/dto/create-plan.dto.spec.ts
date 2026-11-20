import { ValidationPipe } from '@nestjs/common';
import { CreatePlanDto } from '../../../../src/modules/admin/dto/create-plan.dto';
import { UpdatePlanDto } from '../../../../src/modules/admin/dto/update-plan.dto';
import { validationExceptionFactory } from '../../../../src/utils/errors/validation-exception.factory';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  exceptionFactory: validationExceptionFactory,
});
const body = (value: unknown, metatype: new () => object = CreatePlanDto) =>
  pipe.transform(value, { type: 'body', metatype });
const VALID = {
  name: 'Basic',
  durationMonths: 6,
  description: 'Cho NXB nhỏ',
  price: 500000,
  bookLimit: 100000,
  editorLimit: 2,
  note: '',
};

describe('CreatePlanDto', () => {
  it('keeps the case of the name, trims and collapses spaces, and drops unknown fields', async () => {
    await expect(
      body({
        ...VALID,
        name: '  Basic   Plus 2 ',
        description: ' Cho NXB nhỏ ',
        bookCount: 5,
      }),
    ).resolves.toEqual({ ...VALID, name: 'Basic Plus 2' });
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

  it('accepts the same name as the Free plan (only name + duration must be unique)', async () => {
    await expect(body({ ...VALID, name: 'Free' })).resolves.toMatchObject({
      name: 'Free',
    });
  });

  it.each([6, 12, 24])('accepts %i months', async (durationMonths) => {
    await expect(body({ ...VALID, durationMonths })).resolves.toMatchObject({
      durationMonths,
    });
  });

  it.each([
    ['a name with Vietnamese letters', { name: 'Gói cơ bản' }],
    ['a name with a dash', { name: 'basic-plus' }],
    ['a name with HTML', { name: '<b>Pro</b>' }],
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

describe('UpdatePlanDto', () => {
  it('accepts a partial body with the same rules and drops durationMonths', async () => {
    await expect(
      body({ name: ' Pro  Max ', price: 1, durationMonths: 12 }, UpdatePlanDto),
    ).resolves.toEqual({ name: 'Pro Max', price: 1, note: '' });
  });

  it('accepts an empty description (clears it)', async () => {
    await expect(
      body({ description: '  ' }, UpdatePlanDto),
    ).resolves.toMatchObject({ description: '' });
  });

  it.each([
    ['a blank name', { name: ' ' }],
    ['a name with a dash', { name: 'a-b' }],
    ['a zero price', { price: 0 }],
    ['a negative limit', { editorLimit: -1 }],
  ])('rejects %s', async (_label, value) => {
    await expect(body(value, UpdatePlanDto)).rejects.toMatchObject({
      status: 400,
    });
  });
});
