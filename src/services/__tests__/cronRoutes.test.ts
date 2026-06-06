import { beforeEach, describe, expect, it } from 'vitest';
import dailyAlertsHandler from '../../../src/server/api/handlers/cron/dailyAlerts';
import processUserHandler from '../../../src/server/api/handlers/cron/processUser';
import tickHandler from '../../../src/server/api/handlers/cron/tick';

function createRes() {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      return this;
    },
    end(payload?: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('cron route auth', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'cron-secret';
    process.env.INTERNAL_CRON_SECRET = 'worker-secret';
  });

  it('rejects daily alerts requests without the cron secret', async () => {
    const req: any = { method: 'GET', headers: {} };
    const res = createRes();

    await dailyAlertsHandler(req, res);

    expect(res.statusCode).toBe(401);
  });

  it('rejects worker requests without the internal cron secret', async () => {
    const req: any = { method: 'POST', headers: {}, body: { userId: 'user_123' } };
    const res = createRes();

    await processUserHandler(req, res);

    expect(res.statusCode).toBe(401);
  });

  it('rejects tick requests without the cron secret', async () => {
    const req: any = { method: 'POST', headers: {} };
    const res = createRes();

    await tickHandler(req, res);

    expect(res.statusCode).toBe(401);
  });
});
