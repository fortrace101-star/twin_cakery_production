import { pool } from './database/db.js';
(async()=>{
  const r = await pool.query("select column_name, data_type, is_nullable from information_schema.columns where table_name='order_items' order by ordinal_position");
  console.log(JSON.stringify(r.rows,null,2));
  await pool.end();
})().catch(e=>{console.error(e);process.exit(1)});