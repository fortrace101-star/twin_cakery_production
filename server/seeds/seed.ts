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
  "production.quality_check","production.record_wastage","production.record_consumption",
  "inventory.view","inventory.adjust","inventory.reserve","inventory.consume",
  "purchasing.view","purchasing.create","purchasing.approve","purchasing.receive",
  "finance.view","finance.record_payment","finance.record_expense","finance.view_reports",
  "payments.view","payments.record",
  "deliveries.view","deliveries.create","deliveries.dispatch","deliveries.complete","deliveries.cancel",
  "feedback.view","feedback.create","feedback.resolve","feedback.update",
  "users.manage","roles.manage","settings.manage","audit.view",
  "catalogue.view","catalogue.create","catalogue.edit","catalogue.archive",
  "content.view","content.create","content.edit",
  "quotations.view","quotations.create","quotations.accept","quotations.edit",
  "inquiries.view","inquiries.create","inquiries.edit","sales.analytics",
  // E7 staff & remuneration (governing doc §21 + payslip.print per plan §6.2).
  // All 12 land in role-admin via the admin grant loop below — salary stays
  // Admin-only by default (§18.2); role-production gets staff.view only.
  "staff.view","staff.manage","staff.attendance",
  "remuneration.view","remuneration.create","remuneration.edit",
  "remuneration.approve","remuneration.process","remuneration.record_payment",
  "remuneration.close_period","remuneration.view_reports","payslip.print",
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
      ('role-sales','Sales Manager','Sales growth & commercial analytics', TRUE)`,
  );
  for (const [i, key] of PERMS.entries()) {
    // Migrations 012/015/017 run BEFORE the seed on a fresh DB and already
    // inserted some keys with their own ids (e.g. perm-staff-view). Without
    // ON CONFLICT the positional insert died on UNIQUE(key), and the admin
    // grant below referenced `perm-${i+1}` ids that never existed. Insert
    // conflict-safely, then resolve the REAL id by key.
    await pool.query(`INSERT INTO permissions (id, key) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, [
      `perm-${i + 1}`,
      key,
    ]);
    const perm = (await pool.query(`SELECT id FROM permissions WHERE key = $1`, [key])).rows[0] as { id: string } | undefined;
    if (perm) {
      await pool.query(
        `INSERT INTO role_permissions (id, role_id, permission_id) VALUES ($1,'role-admin',$2)
         ON CONFLICT (role_id, permission_id) DO NOTHING`,
        [`rp-admin-${perm.id}`, perm.id],
      );
    }
  }
  const users = [
    ["usr-manager","manager","Manager","manager@twincakery.com","0700 000 001","Admin / Proprietor",true,"role-admin"],
    ["usr-alex","alex","Alex","alex@twincakery.com","0700 000 002","Production Manager",true,"role-production"],
    ["usr-jordan","jordan","Jordan","jordan@twincakery.com","0700 000 003","Sales Manager",false,"role-sales"],
  ] as const;
  for (const [id, username, display, email, phone, role, admin, roleId] of users) {
    await pool.query(
      `INSERT INTO users (id, username, display_name, email, phone, role, is_admin, status, password_hash, notify)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'Active',$8,'{}'::jsonb)`,
      [id, username, display, email, phone, role, admin, passwordHash],
    );
    await pool.query(`INSERT INTO user_roles (id, user_id, role_id) VALUES ($1,$2,$3)`, [`ur-${id}`, id, roleId]);
  }
  // Admin grants for every permission run inside the PERMS loop above (key-
  // resolved). The old positional loop that lived here duplicated them and
  // referenced `perm-${i+1}` ids that migrations 012/015/017 can displace on
  // a fresh DB — an FK violation waiting to happen. Gone.
  // Non-admin roles need their grants too — without them every required()
  // route 403s for Production/Sales/CSR users (and a permission-aware nav
  // would hide the whole workspace). Keys mirror migration 014.
  const roleGrants: Record<string, string[]> = {
    "role-production": [
      "production.view","production.schedule","production.start","production.complete",
      "production.quality_check","production.record_wastage","production.record_consumption",
      "inventory.view","inventory.adjust","inventory.reserve","inventory.consume",
      "purchasing.view","purchasing.create","purchasing.receive",
      "deliveries.view","deliveries.create","deliveries.dispatch","deliveries.complete","deliveries.cancel",
      "orders.view","orders.confirm","customers.view","catalogue.view",
      "staff.view",
    ],
    "role-sales": [
      "orders.view","orders.create","orders.cancel","orders.confirm",
      "quotations.view","quotations.create","quotations.accept","quotations.edit",
      "inquiries.view","inquiries.create","inquiries.edit",
      "customers.view","customers.create","customers.edit",
      "feedback.view","feedback.create",
      "sales.analytics","payments.view","payments.record",
      "deliveries.view","catalogue.view",
    ],
  };
  // E7: Production may see staff identity for scheduling (§18.1) but never a
  // remuneration key (§18.2 confidential). Mirrors migration 017's grants.
  for (const [roleId, keys] of Object.entries(roleGrants)) {
    for (const key of keys) {
      const perm = (await pool.query(`SELECT id FROM permissions WHERE key = $1`, [key])).rows[0];
      if (!perm) continue;
      await pool.query(
        `INSERT INTO role_permissions (id, role_id, permission_id) VALUES ($1,$2,$3)
         ON CONFLICT (role_id, permission_id) DO NOTHING`,
        [`rp-${roleId.replace("role-", "")}-${perm.id}`, roleId, perm.id],
      );
    }
  }
  // Dummy customers intentionally removed � production seed creates none.
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
  // Dummy/sample orders intentionally removed � production seed creates no orders.
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
  // Dummy inquiry/quotation intentionally removed.
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

