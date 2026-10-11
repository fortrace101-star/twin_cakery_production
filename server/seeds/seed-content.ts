/**
 * E2 content seed — idempotent backfill for blog + website users + content.*
 * permissions. The main seed.ts short-circuits when users already exist, so
 * this seeds only the E2 tables (added in migration 009) without touching the
 * rest of the database. Safe to re-run (ON CONFLICT DO NOTHING).
 *
 *   tsx --tsconfig tsconfig.json seeds/seed-content.ts
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pool } from "../database/db.js";

const requireFromFrontend = createRequire(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "erp-interface-design", "package.json"),
);
const bcrypt = requireFromFrontend("bcryptjs") as typeof import("bcryptjs");

const DEV_PASSWORD = process.env.DEV_PASSWORD || "TwinCakery123!";

async function main() {
  // content.* permissions (granted to Admin role)
  const perms = ["content.view", "content.create", "content.edit"] as const;
  for (const [i, key] of perms.entries()) {
    const id = `perm-content-${i + 1}`;
    await pool.query(
      `INSERT INTO permissions (id, key) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [id, key],
    );
    await pool.query(
      `INSERT INTO role_permissions (id, role_id, permission_id) VALUES ($1,'role-admin',$2) ON CONFLICT (id) DO NOTHING`,
      [`rp-content-admin-${i + 1}`, id],
    );
  }

  if ((await pool.query(`SELECT count(*)::int AS n FROM blog_categories`)).rows[0].n === 0) {
    await pool.query(
      `INSERT INTO blog_categories (id, name, slug, description, display_order, active) VALUES
        ('bcat-studio','Studio notes','studio-notes','Behind-the-counter notes from the kitchen',1,TRUE),
        ('bcat-recipes','Recipes & ideas','recipes-ideas','Recipes, tips and sweet inspiration',2,TRUE)
       ON CONFLICT (id) DO NOTHING`,
    );
  }

  if ((await pool.query(`SELECT count(*)::int AS n FROM blog_posts`)).rows[0].n === 0) {
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
         'Twin Cakery','PUBLISHED', now() - interval '20 days')
       ON CONFLICT (id) DO NOTHING`,
    );
  }

  if ((await pool.query(`SELECT count(*)::int AS n FROM website_users`)).rows[0].n === 0) {
    const hash = await bcrypt.hash(DEV_PASSWORD, 10);
    await pool.query(
      `INSERT INTO website_users (id, name, email, phone, password_hash, role, status) VALUES
        ('wuser-1','Site Admin','admin@twincakery.com','0700 000 100',$1,'SITE_ADMIN','ACTIVE'),
        ('wuser-2','Grace Wanjiku','grace@example.com','+256 700 000 013',$1,'CUSTOMER','ACTIVE')
       ON CONFLICT (id) DO NOTHING`,
      [hash],
    );
  }

  const cats = await pool.query(`SELECT count(*)::int AS n FROM blog_categories`);
  const posts = await pool.query(`SELECT count(*)::int AS n FROM blog_posts`);
  const users = await pool.query(`SELECT count(*)::int AS n FROM website_users`);
  console.log(
    `[seed-content] done: ${cats.rows[0].n} blog categories, ${posts.rows[0].n} blog posts, ${users.rows[0].n} website users, content.* perms granted to admin.`,
  );
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
