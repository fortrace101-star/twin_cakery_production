import crypto from 'crypto';
import { pool } from './database/db.js';
const token = 'testtoken2_' + crypto.randomBytes(16).toString('hex');
const hash = crypto.createHash('sha256').update(token).digest('hex');
const now = new Date().toISOString();
const exp = new Date(Date.now()+3600000).toISOString();
await pool.query(
  "INSERT INTO sessions (id,user_id,token_hash,created_at,expires_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING",
  ['sess-test-002','usr-1793879905686-c21f',hash,now,exp]
);
console.log(token);
await pool.end();
