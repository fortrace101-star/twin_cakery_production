import { query } from "./database/db.js";
import crypto from "node:crypto";

const token = "testtoken_" + crypto.randomBytes(16).toString("hex");
const hash = crypto.createHash("sha256").update(token).digest("hex");
const userId = "usr-1793879905686-c21f";
const createdAt = new Date();
const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
await query(
  `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at)
   VALUES ($1, $2, $3, $4, $5)
   ON CONFLICT (id) DO UPDATE SET token_hash = $3, created_at = $4, expires_at = $5
   RETURNING id, user_id`,
  [userId, userId, hash, createdAt, expiresAt]
);
console.log("token:", token);
