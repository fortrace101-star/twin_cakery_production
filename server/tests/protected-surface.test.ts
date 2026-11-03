import { describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import { apiRouter } from '../routes/api.js';

const app = express();
app.use(express.json());
app.use('/api/v1', apiRouter);

describe('SEC P0: protected surface is deny-by-default', () => {
  const protectedMethods = ['get', 'post', 'patch', 'put', 'delete'] as const;

  it('returns 401 on every protected route without a token', async () => {
    // Public surface only: /auth and /public. Everything else must 401.
    const publicPaths = new Set([
      '/auth/login',
      '/auth/register',
      '/auth/claim-admin',
      '/public/inquiries',
      '/public/order-proposals',
    ]);

    const probe = async (
      method: (typeof protectedMethods)[number],
      path: string,
      body?: Record<string, unknown>,
    ) => {
      const res = await request(app)[method](`/api/v1${path}`).send(body);
      return res.status;
    };

    const failures: string[] = [];

    // Core read/write surface that must be behind requireAuth.
    const paths = [
      ['get', '/orders'],
      ['get', '/customers'],
      ['get', '/catalogue/products'],
      ['post', '/orders'],
      ['post', '/purchasing/suppliers'],
      ['post', '/purchasing/orders'],
      ['patch', '/deliveries/test-id'],
      ['post', '/payments'],
      ['get', '/notifications'],
      ['post', '/notifications/read'],
      ['get', '/rbac/users'],
      ['get', '/analytics/dashboard'],
      ['get', '/finance/ledger'],
      ['post', '/inventory/adjust'],
      ['post', '/feedback'],
      ['post', '/customers'],
      ['patch', '/customers/test-id'],
      ['delete', '/customers/test-id'],
      ['post', '/quotations'],
      ['patch', '/quotations/test-id'],
      ['post', '/expenses'],
      ['patch', '/expenses/test-id'],
      ['delete', '/expenses/test-id'],
      ['post', '/production/jobs'],
      ['patch', '/production/jobs/test-id'],
      ['post', '/staff'],
      ['patch', '/staff/test-id'],
      ['post', '/order-proposals'],
      ['patch', '/order-proposals/test-id'],
      ['delete', '/order-proposals/test-id'],
      ['post', '/remuneration/periods'],
      ['patch', '/remuneration/periods/test-id'],
    ];

    for (const [method, path] of paths) {
      const status = await probe(method as (typeof protectedMethods)[number], path);
      if (status !== 401) {
        failures.push(`${method.toUpperCase()} ${path} returned ${status}, expected 401`);
      }
    }

    expect(failures).toEqual([]);
  });

  it('does not falsely 401 on the public surface', async () => {
    const publicOk = await Promise.all([
      request(app).get('/api/v1/public/inquiries').then((r) => r.status),
      request(app).get('/api/v1/public/order-proposals').then((r) => r.status),
    ]);
    // These may 200 or 404 depending on wiring; they must NOT be 401.
    for (const status of publicOk) {
      expect(status).not.toBe(401);
    }
  });
});
