import { describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import { apiRouter } from '../routes/api.js';

const app = express();
app.use(express.json());
app.use('/api/v1', apiRouter);

describe('FIN P1: finance surface', () => {
  it('requires auth for payments and reports', async () => {
    const r1 = await request(app).get('/api/v1/payments');
    expect(r1.status).toBe(401);
    const r2 = await request(app).get('/api/v1/finance/reports');
    expect(r2.status).toBe(401);
  });
});
