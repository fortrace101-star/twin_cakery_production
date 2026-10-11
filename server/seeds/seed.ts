import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const requireFromFrontend = createRequire(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "erp-interface-design", "package.json"),
);
const dotenvModule = requireFromFrontend("dotenv") as { config: () => void };
dotenvModule.config();
const bcryptModule = requireFromFrontend("bcryptjs") as typeof import("bcryptjs");

import { pool } from "../database/db.js";

const DEV_PASSWORD = "TwinCakery123!";

async function count(table: string): Promise<number> {
  const res = await pool.query(`SELECT COUNT(*)::int AS c FROM ${table}`);
  return (res.rows[0] as { c: number }).c;
}

const PERMS = [
  "orders.view","orders.create","orders.confirm","orders.cancel",
  "customers.view","customers.create","customers.edit","customers.interact",
  "products.view","products.create","products.edit","products.archive",
  "production.view","production.schedule","production.start","production.complete",
  "production.quality_check","production.record_wastage",
  "inventory.view","inventory.adjust","inventory.reserve","inventory.consume",
  "purchasing.view","purchasing.create","purchasing.approve","purchasing.receive",
  "finance.view","finance.record_payment","finance.record_expense",
  "payments.view","payments.record",
  "deliveries.view","deliveries.create","deliveries.dispatch","deliveries.complete",
  "feedback.view","feedback.create","feedback.resolve",
  "users.manage","roles.manage","settings.manage","audit.view",
  "catalogue.view","catalogue.create","catalogue.edit","catalogue.archive",
  "content.view","content.create","content.edit",
  "quotations.view","quotations.create","quotations.accept",
  "inquiries.view","inquiries.create","sales.analytics",
];

export async function seed(): Promise<void> {
  if ((await count("users")) > 0) {
    console.log("[seed] already seeded, skipping (users > 0).");
    return;
  }
  const passwordHash = await bcryptModule.hash(DEV_PASSWORD, 10);

  await pool.query(
    `INSERT INTO roles (id, name, label, active) VALUES
      ('role-admin','Admin / Proprietor','Full business control', TRUE),
      ('role-production','Production Manager','Operational fulfillment', TRUE),
      ('role-sales','Sales Manager','Sales growth & commercial analytics', TRUE),
      ('role-csr','Customer Service Representative','Inbound support', TRUE)`,
  );
  for (const [i, key] of PERMS.entries()) {
    await pool.query(`INSERT INTO permissions (id, key) VALUES ($1, $2)`, [`perm-${i + 1}`, key]);
  }
  const users = [
    ["usr-manager","manager","Manager","manager@twincakery.com","0700 000 001","Admin / Proprietor",true,"role-admin"],
    ["usr-alex","alex","Alex","alex@twincakery.com","0700 000 002","Production Manager",true,"role-production"],
    ["usr-jordan","jordan","Jordan","jordan@twincakery.com","0700 000 003","Sales Manager",false,"role-sales"],
    ["usr-priya","priya","Priya","priya@twincakery.com","0700 000 004","Customer Service Representative",false,"role-csr"],
  ] as const;
  for (const [id, username, display, email, phone, role, admin, roleId] of users) {
    await pool.query(
      `INSERT INTO users (id, username, display_name, email, phone, role, is_admin, status, password_hash, notify)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'Active',$8,'{}'::jsonb)`,
      [id, username, display, email, phone, role, admin, passwordHash],
    );
    await pool.query(`INSERT INTO user_roles (id, user_id, role_id) VALUES ($1,$2,$3)`, [`ur-${id}`, id, roleId]);
  }
  for (const [i] of PERMS.entries()) {
    await pool.query(`INSERT INTO role_permissions (id, role_id, permission_id) VALUES ($1,'role-admin',$2)`, [
      `rp-admin-${i + 1}`,
      `perm-${i + 1}`,
    ]);
  }
  const customers = [
    ["cust-sarah","Sarah Mwangi","+256 700 000 011","sarah@example.com"],
    ["cust-david","David Ochieng","+256 700 000 012","david@example.com"],
    ["cust-grace","Grace Wanjiku","+256 700 000 013","grace@example.com"],
    ["cust-james","James Kamau","+256 700 000 014","james@example.com"],
    ["cust-faith","Faith Akinyi","+256 700 000 015","faith@example.com"],
    ["cust-peter","Peter Njoroge","+256 700 000 016","peter@example.com"],
    ["cust-wholesale","Twin Cakery Wholesale","+256 700 000 017","wholesale@example.com"],
  ] as const;
  for (const [id, name, phone, email] of customers) {
    await pool.query(
      `INSERT INTO customers (id, name, phone, email, preferred_contact_method, source, status)
       VALUES ($1,$2,$3,$4,'phone','In-house','Active')`,
      [id, name, phone, email],
    );
    await pool.query(
      `INSERT INTO customer_addresses (id, customer_id, label, line1, city, country, is_default)
       VALUES ($1,$2,'Home','Plot 12 Kampala Road','Kampala','Uganda', TRUE)`,
      [`addr-${id}`, id],
    );
  }
  await pool.query(
    `INSERT INTO catalogue_categories (id, name, code, description, display_order) VALUES
      ('cat-celebration','Celebration cakes','CELEB','Cakes for celebrations',1),
      ('cat-signature','Signature cakes','SIGN','House signatures',2),
      ('cat-cupcakes','Cupcakes','CUPS','Cupcakes',3),
      ('cat-wedding','Wedding cakes','WED','Wedding tiers',4)`,
  );
  await pool.query(
    `INSERT INTO product_types (id, category_id, name, code, display_order) VALUES
      ('pt-celebration','cat-celebration','Celebration','CELEB',1),
      ('pt-signature','cat-signature','Signature','SIGN',1),
      ('pt-cupcake','cat-cupcakes','Cupcake','CUPS',1),
      ('pt-wedding','cat-wedding','Wedding','WED',1)`,
  );
  await pool.query(
    `INSERT INTO products (id, sku, category_id, product_type_id, name, description, base_price, currency, cost_reference) VALUES
      ('prod-choc','TC-CB-001','cat-celebration','pt-celebration','Chocolate celebration cake','2kg chocolate birthday',4500,'UGX','Recipe TC-CHOC-V1'),
      ('prod-red','TC-CB-002','cat-signature','pt-signature','Red velvet cake','Classic red velvet',3800,'UGX','Recipe TC-RED-V1'),
      ('prod-vanilla','TC-CB-003','cat-cupcakes','pt-cupcake','Vanilla cupcakes','24pc vanilla',2400,'UGX','Recipe TC-VAN-V1'),
      ('prod-wedding','TC-CB-004','cat-wedding','pt-wedding','Wedding cake','3-tier custom',18000,'UGX','Recipe TC-WED-V1'),
      ('prod-carrot','TC-CB-005','cat-signature','pt-signature','Carrot cake','Spiced carrot',3200,'UGX','Recipe TC-CARR-V1'),
      ('prod-choccup','TC-CB-006','cat-cupcakes','pt-cupcake','Chocolate cupcakes','12pc chocolate',1800,'UGX','Recipe TC-CHOC-V1')`,
  );
  await pool.query(
    `INSERT INTO recipes (id, product_id, name, is_active) VALUES
      ('rec-choc','prod-choc','Chocolate celebration v1.2', TRUE),
      ('rec-red','prod-red','Red velvet v1.0', TRUE)`,
  );
  await pool.query(
    `INSERT INTO recipe_versions (id, recipe_id, version, notes, total_estimated_cost, wastage_percent) VALUES
      ('recv-choc-12','rec-choc','v1.2','Current house version',1575,5),
      ('recv-red-10','rec-red','v1.0','Base version',1330,5)`,
  );
  await pool.query(
    `INSERT INTO suppliers (id, business_name, contact_person, phone, email, address, active) VALUES
      ('sup-bakers','Bakers Supply Co.','Supply Desk','+256 700 100 001','orders@bakerssupply.ug','Kampala', TRUE),
      ('sup-dairy','Fresh Dairy Uganda','Dairy Desk','+256 700 100 002','orders@freshdairy.ug','Kampala', TRUE),
      ('sup-pack','Packaging House','Pack Desk','+256 700 100 003','orders@packhouse.ug','Kampala', TRUE)`,
  );
  await pool.query(
    `INSERT INTO inventory_items (id, name, sku, category, unit, reorder_level, supplier_id) VALUES
      ('inv-flour','All-purpose flour','ING-001','Dry ingredients','kg',15,'sup-bakers'),
      ('inv-butter','Unsalted butter','ING-002','Dairy','kg',5,'sup-dairy'),
      ('inv-cocoa','Cocoa powder','ING-003','Dry ingredients','kg',3,'sup-bakers'),
      ('inv-sugar','Granulated sugar','ING-004','Dry ingredients','kg',10,'sup-bakers'),
      ('inv-eggs','Fresh eggs','ING-005','Fresh ingredients','pcs',30,'sup-dairy'),
      ('inv-cream','Whipping cream','ING-006','Dairy','L',4,'sup-dairy'),
      ('inv-buttercream','Buttercream mix','ING-007','Misc','batch',3,'sup-pack')`,
  );
  await pool.query(
    `INSERT INTO inventory_transactions (id, item_id, quantity, unit, type, reference, tx_user, unit_cost, notes) VALUES
      ('tx-open-1','inv-flour',8,'kg','OPENING_BALANCE','Opening','usr-manager',120,'Opening position'),
      ('tx-open-2','inv-butter',2.5,'kg','OPENING_BALANCE','Opening','usr-manager',850,'Opening position'),
      ('tx-open-3','inv-cocoa',1.2,'kg','OPENING_BALANCE','Opening','usr-manager',950,'Opening position'),
      ('tx-open-4','inv-sugar',24,'kg','OPENING_BALANCE','Opening','usr-manager',180,'Opening position'),
      ('tx-open-5','inv-eggs',90,'pcs','OPENING_BALANCE','Opening','usr-manager',18,'Opening position'),
      ('tx-open-6','inv-cream',8,'L','OPENING_BALANCE','Opening','usr-manager',650,'Opening position')`,
  );
  // stock_reservations inserted after orders (FK to orders.order_number) — see below.
  const SEED_ORDERS = [
    ["ord-1048","TC-1048","cust-sarah","prod-choc","2 kg · Chocolate · Birthday",4500,"CONFIRMED","PARTIALLY_PAID","PENDING","2026-10-07 10:00","WhatsApp"],
    ["ord-1047","TC-1047","cust-david","prod-red","1.5 kg · Red velvet · Anniversary",3800,"READY_FOR_DELIVERY","PAID","READY_FOR_DISPATCH","2026-10-07 11:30","Website"],
    ["ord-1046","TC-1046","cust-grace","prod-vanilla","24 pieces · Vanilla · Corporate",2400,"CONFIRMED","PAID","PENDING","2026-10-07 13:00","Phone"],
    ["ord-1045","TC-1045","cust-james","prod-wedding","3 tiers · Vanilla & lemon",18000,"IN_PRODUCTION","PARTIALLY_PAID","PENDING","2026-10-08 09:00","Walk-in"],
    ["ord-1044","TC-1044","cust-faith","prod-carrot","1 kg · Cream cheese frosting",3200,"AWAITING_CONFIRMATION","UNPAID","PENDING","2026-10-08 14:00","WhatsApp"],
    ["ord-1043","TC-1043","cust-peter","prod-choccup","12 pieces · Chocolate",1800,"COMPLETED","PAID","DELIVERED","2026-10-09 10:30","Website"],
  ] as const;
  for (const [id, num, cust, prod, variant, total, status, pay, del, at, channel] of SEED_ORDERS) {
    const paid = pay === "UNPAID" ? 0 : pay === "PARTIALLY_PAID" ? total / 2 : total;
    await pool.query(
      `INSERT INTO orders (id, order_number, customer_id, subtotal, total, currency, required_at, notes, status, payment_status, delivery_status, created_by)
       VALUES ($1,$2,$3,$4,$4,'UGX',$5,$6,$7,$8,$9,'usr-manager')`,
      [id, num, cust, total, at, `${variant} · ${channel}`, status, pay, del],
    );
    await pool.query(
      `INSERT INTO order_items (id, order_id, product_id, variant_options, quantity, unit_price, total, recipe_version)
       VALUES ($1,$2,$3,$4,1,$5,$5,'v1.2')`,
      [`oi-${id}`, id, prod, variant, total],
    );
    await pool.query(
      `INSERT INTO order_status_history (id, order_id, previous_status, new_status, changed_by, reason)
       VALUES ($1,$2,'INQUIRY',$3,'usr-manager','Seeded order')`,
      [`osh-${id}`, id, status],
    );
    await pool.query(
      `INSERT INTO payments (id, order_id, amount, method, reference, received_by, notes)
       VALUES ($1,$2,$3,'Cash',$4,'usr-manager','Seed payment')`,
      [`pay-${id}`, id, paid, num],
    );
    await pool.query(
      `INSERT INTO deliveries (id, order_id, type, destination, status, notes)
       VALUES ($1,$2,'HOME_DELIVERY','Kampala',$3,'Seed delivery')`,
      [`del-${id}`, id, del],
    );
    await pool.query(
      `INSERT INTO customer_feedback (id, customer_id, order_id, rating, type, comment, recorded_by)
       VALUES ($1,$2,$3,5,'GENERAL','Beautiful cake and excellent service!','usr-priya')`,
      [`fb-${id}`, cust, id],
    );
    await pool.query(
      `INSERT INTO audit_logs (id, order_id, actor, action, entity_type, entity_id, previous_status, new_status, reason)
       VALUES ($1,$2,'usr-manager','order:status_changed','order',$2,'INQUIRY',$3,'Seeded order')`,
      [`audit-${id}`, id, status],
    );
  }
  await pool.query(
    `INSERT INTO stock_reservations (id, item_id, quantity, unit, order_id, reference) VALUES
      ('res-1','inv-flour',2,'kg','ord-1048','TC-1048'),
      ('res-2','inv-butter',0.5,'kg','ord-1047','TC-1047')`,
  );
  await pool.query(
    `INSERT INTO expense_categories (id, name) VALUES ('exp-ing','Ingredients'),('exp-pack','Packaging'),('exp-util','Utilities')`,
  );
  await pool.query(
    `INSERT INTO expenses (id, category_id, amount, payment_method, reference, description, recorded_by)
     VALUES ('exp-1','exp-ing',3200,'Cash','EXP-001','Ingredient procurement','usr-manager')`,
  );
  await pool.query(
    `INSERT INTO purchase_orders (id, po_number, supplier_id, total, status, notes) VALUES
      ('po-28','PO-0028','sup-bakers',12400,'SENT','Flour, cocoa powder'),
      ('po-27','PO-0027','sup-dairy',9800,'ACCEPTED','Butter, cream'),
      ('po-26','PO-0026','sup-pack',6400,'COMPLETED','Cake boxes, boards')`,
  );
  await pool.query(
    `INSERT INTO notifications (id, event_type_id, title, message, priority, entity_type, entity_id, created_by)
     VALUES ('notif-1','StockShortageDetected','3 ingredients are running low','Review stock before the next batch.','HIGH','inventory','inv-flour','usr-manager')`,
  );
  await pool.query(
    `INSERT INTO inquiries (id, customer_id, channel, subject, summary, status, priority, source)
     VALUES ('inq-1','cust-faith','WhatsApp','Carrot cake enquiry','1kg carrot cake for Friday','NEW','MEDIUM','WHATSAPP')`,
  );
  await pool.query(
    `INSERT INTO quotations (id, quotation_number, customer_id, notes, status, total, created_by)
     VALUES ('qt-1','QT-1044','cust-faith','Carrot cake quote','SENT',3200,'usr-manager')`,
  );

  // ---- E2: website content (blog + website users) ----
  await pool.query(
    `INSERT INTO blog_categories (id, name, slug, description, display_order, active) VALUES
      ('bcat-studio','Studio notes','studio-notes','Behind-the-counter notes from the kitchen',1,TRUE),
      ('bcat-recipes','Recipes & ideas','recipes-ideas','Recipes, tips and sweet inspiration',2,TRUE)`,
  );
  await pool.query(
    `INSERT INTO blog_posts (id, category_id, title, slug, excerpt, body, author, status, published_at) VALUES
      ('bpost-1','bcat-studio','Why Twin Cakery uses WhatsApp for orders','why-twin-cakery-uses-whatsapp-for-orders',
       'Every cake starts as a conversation. Here is why ordering by WhatsApp keeps things simple, personal and reliable.',
       'Ordering a cake should feel personal. WhatsApp lets us confirm flavours, sizes and designs in real time, share photos, and agree delivery windows without back-and-forth forms. It is the fastest way to get your celebration exactly right.',
       'Twin Cakery','PUBLISHED', now() - interval '8 days'),
      ('bpost-2','bcat-studio','From our kitchen to your table','from-our-kitchen-to-your-table',
       'A quick look behind the counter at how a made-to-order cake moves from idea to delivery.',
       'From the first message to the final hand-off, every cake is baked fresh to order. We plan the bake, check ingredients, decorate by hand, and run a quality check before dispatch so what arrives is exactly what you pictured.',
       'Twin Cakery','PUBLISHED', now() - interval '14 days'),
      ('bpost-3','bcat-recipes','Mini cakes for just about any occasion','mini-cakes-for-just-about-any-occasion',
       'Bite-sized celebrations that disappear in seconds and still do the talking for you.',
       'Mini cakes are the perfect crowd-pleaser for birthdays, office treats and gifting. Pick a flavour, choose a quantity, and we will box them ready to share.',
       'Twin Cakery','PUBLISHED', now() - interval '20 days')`,
  );
  const sitePasswordHash = await bcryptModule.hash(DEV_PASSWORD, 10);
  await pool.query(
    `INSERT INTO website_users (id, name, email, phone, password_hash, role, status) VALUES
      ('wuser-1','Site Admin','admin@twincakery.com','0700 000 100',$1,'SITE_ADMIN','ACTIVE'),
      ('wuser-2','Grace Wanjiku','grace@example.com','+256 700 000 013',$1,'CUSTOMER','ACTIVE')`,
    [sitePasswordHash],
  );

  console.log("[seed] done: users, customers, catalogue, inventory, 6 orders (UGX), finance, notifications, blog, website users.");
}

const invokedDirectly = process.argv[1] !== undefined && process.argv[1].endsWith("seed.ts");
if (invokedDirectly) {
  seed()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
