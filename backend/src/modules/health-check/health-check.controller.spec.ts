import { DataSource } from 'typeorm';
import { ERRORS } from '../../utils/errors/errors';
import { HealthCheckController } from './health-check.controller';

describe('HealthCheckController', () => {
  const query = jest.fn();
  const controller = new HealthCheckController({
    query,
  } as unknown as DataSource);

  beforeEach(() => query.mockReset());

  it('returns ok when the database responds', async () => {
    query.mockResolvedValue([{ '?column?': 1 }]);

    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });
  });

  it('throws SERVICE_UNAVAILABLE when the database is down', async () => {
    query.mockRejectedValue(new Error('connection refused'));

    await expect(controller.check()).rejects.toMatchObject({
      code: ERRORS.SERVICE_UNAVAILABLE.code,
    });
  });
});
