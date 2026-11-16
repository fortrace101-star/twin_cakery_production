import { pool } from './database/db.js';
(async()=>{
  const r = await pool.query("select id, order_number, status, version, total, subtotal, discount, delivery_charge, tax_amount from orders where id='order-1794624738199-fc6d'");
  console.log('order', JSON.stringify(r.rows[0]));
  const items = await pool.query("select * from order_items where order_id='order-1794624738199-fc6d'");
  console.log('items', JSON.stringify(items.rows));
  await pool.end();
})().catch(e=>{console.error(e);process.exit(1)});
