import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  HealthCheckError,
  HealthCheckService,
  HealthIndicatorResult,
  TerminusModule,
} from '@nestjs/terminus';
import type { HealthIndicatorPort } from './health-indicator.port';
import { HEALTH_INDICATORS } from './health-indicators.token';
import { HealthController } from './health.controller';

async function createController(
  indicators: readonly HealthIndicatorPort[],
): Promise<HealthController> {
  const moduleRef = await Test.createTestingModule({
    imports: [TerminusModule],
    controllers: [HealthController],
    providers: [{ provide: HEALTH_INDICATORS, useValue: indicators }],
  }).compile();

  return moduleRef.get(HealthController);
}

function indicator(result: HealthIndicatorResult): HealthIndicatorPort {
  return { check: () => Promise.resolve(result) };
}

describe('HealthController', () => {
  it('reports ok while no indicator is registered', async () => {
    const result = await (await createController([])).check();

    expect(result.status).toBe('ok');
    expect(result.details).toStrictEqual({});
  });

  it('runs every registered indicator and reports each under its own key', async () => {
    const controller = await createController([
      indicator({ redis: { status: 'up' } }),
      indicator({ mongodb: { status: 'up' } }),
    ]);

    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.details).toStrictEqual({
      redis: { status: 'up' },
      mongodb: { status: 'up' },
    });
  });

  it('surfaces a failing indicator without hiding the healthy ones', async () => {
    const controller = await createController([
      indicator({ redis: { status: 'up' } }),
      {
        check: () =>
          Promise.reject(
            new HealthCheckError('mongodb is unreachable', {
              mongodb: { status: 'down' },
            }),
          ),
      },
    ]);

    const result = await controller
      .check()
      .catch((error: ServiceUnavailableException) => error.getResponse());

    expect(result).toMatchObject({
      status: 'error',
      info: { redis: { status: 'up' } },
      error: { mongodb: { status: 'down' } },
    });
  });

  it('delegates the aggregation to terminus rather than reimplementing it', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [{ provide: HEALTH_INDICATORS, useValue: [] }],
    }).compile();

    const health = moduleRef.get(HealthCheckService);
    const check = jest.spyOn(health, 'check');

    await moduleRef.get(HealthController).check();

    expect(check).toHaveBeenCalledTimes(1);
  });
});
