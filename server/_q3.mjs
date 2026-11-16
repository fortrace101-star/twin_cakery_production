import { pool } from './database/db.js';
(async()=>{
  const r = await pool.query("select column_name, data_type from information_schema.columns where table_name='order_revisions' order by ordinal_position");
  console.log(JSON.stringify(r.rows,null,2));
  await pool.end();
})().catch(e=>{console.error(e);process.exit(1)});