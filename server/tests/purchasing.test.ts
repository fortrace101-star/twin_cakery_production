import { describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import { apiRouter } from '../routes/api.js';

const app = express();
app.use(express.json());
app.use('/api/v1', apiRouter);

describe('PUR P0: purchasing tests', () => {
  it('unauthenticated create supplier rejected with 401', async () => {
    const res = await request(app).post('/api/v1/purchasing/suppliers').send({ businessName: 'Test' });
    expect(res.status).toBe(401);
  });

  it('unauthenticated create purchase order rejected with 401', async () => {
    const res = await request(app).post('/api/v1/purchasing/orders').send({});
    expect(res.status).toBe(401);
  });
});
