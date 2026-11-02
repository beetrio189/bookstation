import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from '../../src/interceptors/response.interceptor';

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor();
  const run = (value: unknown) =>
    lastValueFrom(
      interceptor.intercept(
        {} as ExecutionContext,
        {
          handle: () => of(value),
        } as CallHandler,
      ),
    );

  it('wraps an object in data', async () => {
    await expect(run({ id: '1', name: 'Wing' })).resolves.toEqual({
      data: { id: '1', name: 'Wing' },
    });
  });

  it('puts an array in data.items', async () => {
    await expect(run([{ id: '1' }])).resolves.toEqual({
      data: { items: [{ id: '1' }] },
    });
    await expect(run([])).resolves.toEqual({ data: { items: [] } });
  });

  it.each([[undefined], [null]])('returns empty data for %s', async (value) => {
    await expect(run(value)).resolves.toEqual({ data: {} });
  });

  it('omits null properties at every level but keeps other values', async () => {
    const createdAt = new Date('2026-11-01T00:00:00.000Z');

    await expect(
      run({
        bio: null,
        count: 0,
        active: false,
        name: '',
        createdAt,
        edition: { cover: null, title: 'Rừng Na Uy' },
        items: [{ page: null, id: '1' }],
      }),
    ).resolves.toEqual({
      data: {
        count: 0,
        active: false,
        name: '',
        createdAt,
        edition: { title: 'Rừng Na Uy' },
        items: [{ id: '1' }],
      },
    });
  });
});
