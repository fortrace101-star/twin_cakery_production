# Optim_catalogue_recipes.md — Catalogue & Recipes

**Module owner of:** products, categories, product types, variants/options, recipes, recipe versions, recipe costing, allergens, price history.
**Companion files:** `Optim_orders.md`, `Optim_quotations.md`, `Optim_production.md`, `Optim_inventory.md`, `Optim_purchasing.md`, `Optim_finance.md`, `Optim_analytics.md`, `Optim_notifications_audit.md`, `Optim_security_rbac.md`, `Optim_website.md`, `Optim_architecture.md`.

---

## 0. How to read this document

**Basis.** Every finding below was checked against the code in `twin_cakery_production-main.zip` (not only the audit text). Where the code differs from the audit I say so in section A.3.

**Verification labels**

| Label | Meaning |
|---|---|
| **Verified** | I read the exact lines and cite the file. |
| **Inferred** | Follows from verified code, but I did not trace every caller. |
| **Not run** | I did not run the app, so runtime behaviour is reasoned, not observed. |

**Unified recommendations.** Each recommendation (R1…R8) has the same shape: *what changes in this module*, then a **Cross-module changes** table listing what changes in every other module and how. Where another module owns the change, its file has the full detail and this file carries only the hook.

**Migration numbers.** This file uses `022`–`026`. `Optim_website.md` continues at `027`. If other module files also propose numbers, renumber in the order you actually apply them and never edit a migration that has already run.

**Code conventions.** Snippets use real names from your repo (`store`, `required()`, `store.createAuditLog`, `pool` from `database/db.ts`, `NotFoundError`, `ValidationError`, `ConflictError`). The server has no `zod` dependency today (`server/package.json` lists `express` and `pg` only), so `npm i zod` in `server/` is a prerequisite. Migration numbers continue from `021` (note that two files already share `020`; the runner sorts by name, so this works, but avoid a third).

**Important architectural note.** Catalogue routes mutate `store.db.catalogue.*` in memory and rely on write-back. Recipe tables are not loaded into the store at all (A.2, CR-1). New recipe code is therefore written as direct Postgres repositories (`pool.query`), which is also the direction recommended in `Optim_architecture.md`. Do not add recipes to the in-memory store.

---

# PART A — ASSESSMENT

## A.1 What exists today (Verified)

| Area | State |
|---|---|
| Tables | `catalogue_categories`, `product_types`, `products`, `product_variants`, `option_definitions`, `option_values`, `recipes`, `recipe_versions`, `recipe_items`, `ingredient_defaults` (migration `002_catalogue.sql`). |
| Routes | `routes/catalogue.ts`: categories (list/create/patch), types (list/create), products (list/create/get/patch/archive). Permissions `catalogue.view/create/edit/archive`. |
| Public routes | `GET /public/catalogue`, `GET /public/products/:id` in `routes/public.ts`. |
| ERP UI | `module-table.tsx` → `Catalogue` component with tabs Products, Categories, Product types, Variants. Product card grid, visibility toggle, archive, `ProductDialog`. The **Variants** tab is a placeholder ("ships with the next catalogue release"). |
| Recipes | Tables exist; the TypeScript types `Recipe`, `RecipeVersion`, `RecipeItem` exist in `database/types.ts`; seed inserts 2 recipes and 2 versions (no items). **No routes, no UI, no store loader.** |
| Costing link | Production consumption uses `inventory_items.cost` (`recordMaterialsUsed`, `business.service.ts`). Products carry a free-text `costReference` ("Recipe TC-WED-V1"). |

## A.2 Findings

Severity: **S1** exploitable or money-affecting, **S2** wrong data or broken workflow, **S3** gap or hygiene.

### CR-1 (S2) Recipes exist only as empty tables — Verified

- `recipes` / `recipe_versions` / `recipe_items` have no endpoints (`routes/catalogue.ts` contains none) and no store loader (`database/store.ts` references recipes only through the string `recipeVersion` on order lines and jobs).
- Seed data (`seeds/seed.ts` ~line 157) creates versions with **hard-coded** `total_estimated_cost` (1575 and 1330) and **no `recipe_items`**. Those totals are not derived from anything.
- Only 2 of the 6 seeded products have a recipe row at all.
- `recipe_items.ingredient_id` is `TEXT NOT NULL` with **no foreign key** to `inventory_items`, so an item can point at nothing.

**Scenario.** The baker asks "how much flour for the 2kg chocolate cake?" There is nowhere in the app to look it up. Materials are typed in by hand on each job (`recordMaterialsUsed`), so two bakers record different quantities for the same cake and margin per cake varies by who was on shift.

### CR-2 (S2) `costReference` is free text with no link to a recipe — Verified

- `products.cost_reference TEXT` holds strings such as `Recipe TC-CHOC-V1`.
- The two seeds disagree: `database/index.ts` (file-store baseline) says `TC-CHOC-V2` for the chocolate cake; `seeds/seed.ts` says `TC-CHOC-V1`; the recipe row is named `Chocolate celebration v1.2`. There is no key that joins them.

**Scenario.** Finance wants the cost of the red velvet cake. The product says "Recipe TC-RED-V1", the recipe is named "Red velvet v1.0". Someone has to match them by eye, and a rename breaks the connection silently.

### CR-3 (S1) Public single-product endpoint leaks internal fields — Verified

`GET /public/products/:id` in `routes/public.ts`:

```ts
const { cost_reference: _cost, ...safe } = product as typeof product & { cost_reference?: unknown };
res.json({ ...safe, category: category?.name || "" });
```

The product object uses **camelCase** (`costReference`, per `database/types.ts`), so destructuring `cost_reference` removes nothing. The response includes `costReference`, `notes` (internal; the seed contains "Standard 2kg tier" and "Requires enquiry") and `productionEnabled`. The list endpoint `GET /public/catalogue` does whitelist fields correctly, so the two public endpoints disagree.

**Scenario.** Today `costReference` is a label. The moment you follow R3 and store a standard cost or margin note there, any visitor can read it with one URL: `/api/v1/public/products/prod-wedding`.

Related, same file: `GET /public/catalogue` returns `categories` **unfiltered** (`store.db.catalogue?.categories || []`), including categories where `active` or `catalogueVisible` is false. A hidden category's name and description are public.

### CR-4 (S1/S2) Catalogue writes accept anything — Verified

- `PATCH /categories/:id` and `PATCH /products/:id` do `{ ...before, ...req.body }`. A caller with `catalogue.edit` can overwrite `id`, `createdAt`, `archived`, `sku` and any unknown key.
- `POST /products` destructures a `productId` field and stores it as the product's `productId`. The table has `product_type_id`, which is **never set** by this route, so product types cannot actually be assigned (the Product types tab lists types but no product belongs to one).
- No SKU uniqueness check in memory. The DB column is `UNIQUE`. A duplicate SKU succeeds in memory, then the write-back fails; the durability gate in `index.ts` returns **500 "Failed to persist changes"** while the duplicate **stays in the in-memory cache**. The cache and database now disagree until restart.
- `basePrice: basePrice || 0` accepts negative numbers and numeric strings. Nothing bounds the value.
- `POST /types` does not verify that `categoryId` exists.
- Category `PATCH` has no audit entry at all (product changes do).

**Scenario.** A staff member creates a second "TC-CB-001". The screen shows an error toast, but the list now shows two products with the same SKU. After the next restart one disappears.

### CR-5 (S2) Price changes leave no history and variants carry no price — Verified

- A price change is recorded only as a text `reason` string ("price 4500 → 4800") in the audit log; there is no queryable `price_history`, no effective date, and no user-visible history.
- `option_definitions` / `option_values` have **no price, cost or quantity columns**. Order lines store `variantOptions` as **free text**, and the public proposal path stores up to 300 characters of whatever the client sent. A "3-tier" or "2kg" choice cannot change the price or the recipe quantity.
- The Variants tab is a placeholder.

**Scenario.** A customer orders the wedding cake online at the flat `basePrice` of 18,000 for "3-tier custom". The seed note on that product says "Requires enquiry". The website quotes a price that the business would never honour for a custom tiered cake.

### CR-6 (S2) Archive and visibility lifecycle is incomplete — Verified

- `POST /products/:id/archive` sets `archived: true, active: false` with no check for open orders, open quotations or open order proposals that reference the product.
- There is no unarchive endpoint and no "draft/published" step; creating a product with `catalogueVisible` true publishes it to the website immediately.
- `GET /catalogue` (the root list) returns **only visible** products while `GET /catalogue/products` returns all, so two internal lists disagree.
- Product images: the ERP card only accepts `http(s)://` URLs (`module-table.tsx`), but seed products store `chocolate-cake.jpg` / `wedding.jpg`, which fail that test and fall back to a placeholder. There is no upload (`express.json` limit is 100 kb), so staff must host images elsewhere.

### CR-7 (S3) Missing product attributes a bakery needs — Inferred

No fields for: serves/portion count, lead time or minimum notice, requires-quote flag, shelf life, allergens, dietary tags (eggless, vegan), or a public-facing description separate from the internal `notes`. Allergens in particular cannot be derived because ingredients are not linked to recipes (CR-1).

### CR-8 (S2) Costing path is only partly correct — Verified (and differs from the audit)

The audit says consumption "uses the order line's selling price as unit cost". I re-checked both paths in `business.service.ts`:

- `recordMaterialsUsed` (the **wired** manual path, called from the job dialog) uses `item.cost` (inventory unit cost). That part is correct.
- `recordConsumption` (the older path, noted in a code comment as **unwired**) is the one that derives entries from order items, and it is the one the audit's selling-price concern applies to. It is not on a live route.
- Still true on the wired path: each submission writes a **new** `production_costs` row (`status: "ACTUAL"`) with `packagingCost: 0`, `labourCost: 0`, `overheadCost: 0`, so a job with two submissions has two cost rows, and packaging and labour are never costed.
- The stock check compares against `physicalStock`, not stock minus other orders' reservations (also an Inventory finding; fixed in `Optim_inventory.md`).

Net effect: ingredient cost is roughly right per entry, but there is no **planned** cost to compare against, and labour and packaging are missing from margin.

## A.3 Corrections to the earlier audit

| Audit statement | What the code shows |
|---|---|
| "Server-side visibility rules for the website are good" | True for orders and the list endpoint. **Not** true for `GET /public/products/:id` (CR-3) or the category list. |
| "recordConsumption uses selling price as unit cost" | Applies to the unwired older method. The wired method uses `item.cost` (CR-8). |
| "No recipe endpoints" | Confirmed, and there is also no store loader or UI. |

---

# PART B — OPTIMISATION, CORRECTION AND IMPROVEMENT

## Build order for this module

| Step | Recommendation | Effort | Why this position |
|---|---|---|---|
| 1 | R1 Public leak fix | ~1 hour | Security; no dependencies. |
| 2 | R2 Harden catalogue writes | 0.5 day | Needed before anything builds on product data. |
| 3 | R3 Recipe management (schema, API, UI) | 3–5 days | The missing link between catalogue, inventory, finance. |
| 4 | R4 Variants with price and recipe scaling | 2–3 days | Needs R3 for scaling. |
| 5 | R5 Cost roll-up and margin guard | 1–2 days | Needs R3 and inventory cost events. |
| 6 | R6 Allergens and product specification | 1–2 days | Needs R3. |
| 7 | R7 Lifecycle, price history, publish workflow | 1–2 days | Independent; can run earlier. |
| 8 | R8 Product media | 1 day | Pairs with `Optim_website.md` W-7. |

---

## R1 — Close the public data leak (fixes CR-3)

### Module changes: Catalogue / Public API

Replace blacklisting (`delete the bad key`) with a single whitelist used by **both** public endpoints, and filter categories.

```ts
// server/routes/public.ts
type CatalogueProduct = NonNullable<typeof store.db.catalogue>["products"][number];

/** The ONLY shape the public site may ever see. Add fields here deliberately. */
function toPublicProduct(p: CatalogueProduct, categoryName = "") {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    categoryId: p.categoryId,
    category: categoryName,
    image: p.image,
    basePrice: p.basePrice,
    currency: (p as { currency?: string }).currency ?? "UGX",
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

const isPublic = (p: CatalogueProduct) =>
  p.catalogueVisible === true && p.active === true && p.archived !== true;

router.get("/catalogue", (_req, res) => {
  const cats = (store.db.catalogue?.categories ?? []).filter(
    (c) => c.active && c.catalogueVisible,
  );
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  // A product in a hidden/inactive category must not appear either.
  const products = (store.db.catalogue?.products ?? [])
    .filter(isPublic)
    .filter((p) => catName.has(p.categoryId))
    .map((p) => toPublicProduct(p, catName.get(p.categoryId)));
  res.set("Cache-Control", "public, max-age=60");
  res.json({
    categories: cats.map(({ id, name, description, image, displayOrder }) => ({
      id, name, description, image, displayOrder,
    })),
    products,
    featured: products.slice(0, 6),
  });
});

router.get("/products/:id", (req, res) => {
  const p = store.db.catalogue?.products?.find((x) => x.id === String(req.params.id));
  if (!p || !isPublic(p)) throw new NotFoundError("Product not found");
  const cat = store.db.catalogue?.categories?.find((c) => c.id === p.categoryId);
  if (!cat || !cat.active || !cat.catalogueVisible) throw new NotFoundError("Product not found");
  res.json(toPublicProduct(p, cat.name));
});
```

Note: the existing `featured` rule (`visible.slice(0, 6)`) simply takes the first six. R7 adds a real `featured` flag.

### Test (add first)

```ts
// server/tests/public-catalogue.test.ts  (vitest + supertest)
it("never exposes internal fields on the single-product endpoint", async () => {
  const res = await request(app).get("/api/v1/public/products/prod-wedding");
  expect(res.status).toBe(200);
  for (const k of ["costReference", "cost_reference", "notes", "productionEnabled", "sku"]) {
    expect(res.body).not.toHaveProperty(k);
  }
});
it("hides products and categories that are hidden or inactive", async () => { /* seed hidden cat, assert absent */ });
```

### Cross-module changes

| Module | Change | How |
|---|---|---|
| **Website** | The mapper `mapErpProduct` (`sweet-moments-cakery-web/src/lib/catalogue-api.ts`) already ignores unknown fields; add `basePrice`, `currency`, `category` to `ErpProduct` so prices can be displayed (see `Optim_website.md` W-4). | Type change plus mapper. |
| **Security/RBAC** | Add a CI check that fails if a public route returns a key from a deny-list. | The test above, generalised in `Optim_security_rbac.md`. |
| **Audit** | No change. | n/a |

---

## R2 — Harden catalogue writes (fixes CR-4)

### Module changes: Catalogue API

Install zod, define per-action schemas, whitelist updatable fields, enforce SKU uniqueness against **both** cache and database, bound prices, and set `productTypeId`.

```ts
// server/routes/catalogue.schemas.ts
import { z } from "zod";

const money = z.number().finite().min(0).max(100_000_000);   // UGX has no decimals; see Optim_finance.md
export const productCreate = z.object({
  sku: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9._-]+$/),
  categoryId: z.string().min(1),
  productTypeId: z.string().min(1).nullable().optional(),
  name: z.string().trim().min(2).max(150),
  description: z.string().max(1000).default(""),
  basePrice: money,
  catalogueVisible: z.boolean().default(false),   // default hidden until reviewed (R7)
  productionEnabled: z.boolean().default(true),
  image: z.string().url().max(500).or(z.literal("")).default(""),
  notes: z.string().max(1000).default(""),
}).strict();

export const productUpdate = productCreate.partial().omit({ sku: true }).strict();
export const categoryUpdate = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500),
  image: z.string().max(500),
  displayOrder: z.number().int().min(0).max(9999),
  active: z.boolean(),
  catalogueVisible: z.boolean(),
}).partial().strict();
```

```ts
// server/routes/catalogue.ts (replacing the POST/PATCH handlers)
router.post("/products", required("catalogue.create"), (req, res) => {
  const body = productCreate.parse(req.body);                       // ZodError -> 400 via error middleware
  const products = store.db.catalogue.products;
  if (products.some((p) => p.sku.toLowerCase() === body.sku.toLowerCase()))
    throw new ConflictError(`SKU ${body.sku} already exists`);
  if (!store.db.catalogue.categories.some((c) => c.id === body.categoryId))
    throw new ValidationError("categoryId does not exist");
  if (body.productTypeId && !store.db.catalogue.types.some((t) => t.id === body.productTypeId && t.categoryId === body.categoryId))
    throw new ValidationError("productTypeId does not belong to that category");

  const now = new Date().toISOString();
  const product = { id: `prod-${crypto.randomUUID()}`, ...body, currency: "UGX",
                    costReference: "", archived: false, active: true, createdAt: now, updatedAt: now };
  products.push(product as never);
  emitDomainEvent({ type: "product.created", entityType: "product", entityId: product.id, actorId: sessionUserId(req),
                    data: { sku: product.sku, basePrice: product.basePrice } });   // Optim_notifications_audit.md
  store.db.persist();
  res.status(201).json(product);
});

router.patch("/products/:id", required("catalogue.edit"), (req, res) => {
  const patch = productUpdate.parse(req.body);
  const idx = store.db.catalogue.products.findIndex((p) => p.id === String(req.params.id));
  if (idx === -1) throw new NotFoundError("Product not found");
  const before = store.db.catalogue.products[idx];

  // A price change is a financial event: separate permission, mandatory reason, history row (R7).
  if (patch.basePrice !== undefined && patch.basePrice !== before.basePrice) {
    requirePermissionSync(req, "catalogue.change_price");
    const reason = z.string().trim().min(3).parse(req.body.priceChangeReason);   // add to schema as optional field
    recordPriceChange(before.id, before.basePrice, patch.basePrice, sessionUserId(req), reason);
  }
  const after = { ...before, ...patch, updatedAt: new Date().toISOString() };
  store.db.catalogue.products[idx] = after;
  emitDomainEvent({ type: "product.updated", entityType: "product", entityId: after.id,
                    actorId: sessionUserId(req), data: { before: pick(before, Object.keys(patch)), after: pick(after, Object.keys(patch)) } });
  store.db.persist();
  res.json(after);
});
```

`emitDomainEvent`, `sessionUserId`, `requirePermissionSync`, `recordPriceChange` and `pick` are small helpers you add (the first is the event spine in `Optim_notifications_audit.md`; if you have not built it yet, call `store.createAuditLog` with the same payload and swap later). The same `strict()` + whitelist treatment applies to `PATCH /categories/:id` (and add the missing audit entry), and `POST /types` must verify `categoryId`.

### Database

```sql
-- 022_catalogue_hardening.sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS public_description TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS ux_products_sku_ci ON products (lower(sku));
ALTER TABLE products ADD CONSTRAINT chk_products_price_nonneg CHECK (base_price >= 0) NOT VALID;
ALTER TABLE products VALIDATE CONSTRAINT chk_products_price_nonneg;
-- product types were never assigned: surface any orphan rows before relying on them
-- SELECT id, name FROM products WHERE product_type_id IS NULL;
```

### UI adjustments (existing)

`ProductDialog` (`module-table.tsx`):
- Add **Product type** select (filtered by chosen category). Today it cannot be set.
- Show inline validation (SKU format, price ≥ 0) and the server's 409 message as a field error ("SKU already exists") instead of a generic toast.
- New products default to **Hidden** with a "Publish" action (R7) rather than appearing on the website the moment they are saved.
- When the price changes, show a required **Reason for price change** field. Hide the price input for users without `catalogue.change_price`.
- The product card shows a "Price changed 12 Oct by …" tooltip once R7 history exists.

### Cross-module changes

| Module | Change | How |
|---|---|---|
| **RBAC** | New permission `catalogue.change_price`. Grant to Admin and Finance; not to Production or Sales. | Migration in R3's section (grants). |
| **Orders / Quotations** | Both must price lines from this table on the server, never from the client (`Optim_orders.md` O-3, `Optim_quotations.md` Q-3). They call the shared `priceLine()` from R4. | Import the shared function. |
| **Audit / Notifications** | `product.price_changed` event; rule: price change above ±15% notifies Admin and Finance (requires acknowledgement). | Rule row in `notification_rules`. |
| **Finance** | Price history feeds margin-by-period. | `product_price_history` (R7). |
| **Website** | Public cache is invalidated by `updatedAt`; no change needed. | n/a |
| **Architecture** | Duplicate-SKU divergence disappears once catalogue reads/writes go through Postgres (`Optim_architecture.md`). Until then the in-memory check above prevents it. | n/a |

---

## R3 — Recipe management: the missing link (fixes CR-1, CR-2, CR-8)

### Concept

A **recipe** belongs to a product. A recipe has **versions**. A version has **items** (inventory ingredients with quantity per *recipe yield*), plus labour minutes, packaging and overhead. Only one version per recipe is **APPROVED** at a time. A job copies the approved version's id at creation, so history never changes retroactively.

### Database

```sql
-- 023_recipes_costing.sql
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS yield_quantity NUMERIC(14,3) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS yield_unit     TEXT          NOT NULL DEFAULT 'cake';

ALTER TABLE recipe_versions
  ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','PENDING_APPROVAL','APPROVED','RETIRED')),
  ADD COLUMN IF NOT EXISTS labour_minutes INTEGER       NOT NULL DEFAULT 0 CHECK (labour_minutes >= 0),
  ADD COLUMN IF NOT EXISTS packaging_cost NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (packaging_cost >= 0),
  ADD COLUMN IF NOT EXISTS overhead_pct   NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (overhead_pct BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS created_by     TEXT,
  ADD COLUMN IF NOT EXISTS approved_by    TEXT,
  ADD COLUMN IF NOT EXISTS approved_at    TIMESTAMPTZ;

-- Exactly one approved version per recipe.
CREATE UNIQUE INDEX IF NOT EXISTS ux_recipe_one_approved
  ON recipe_versions (recipe_id) WHERE status = 'APPROVED';

-- Maker–checker: the approver cannot be the creator.
ALTER TABLE recipe_versions ADD CONSTRAINT chk_recipe_maker_checker
  CHECK (approved_by IS NULL OR approved_by IS DISTINCT FROM created_by) NOT VALID;

-- Ingredients must be real inventory items. NOT VALID first: the table is empty today, but this is safe if it is not.
ALTER TABLE recipe_items
  ADD CONSTRAINT fk_recipe_items_inventory FOREIGN KEY (ingredient_id)
  REFERENCES inventory_items(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE recipe_items VALIDATE CONSTRAINT fk_recipe_items_inventory;
CREATE INDEX IF NOT EXISTS idx_recipe_items_version ON recipe_items(recipe_version_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_recipes_product_active ON recipes(product_id) WHERE is_active;

-- A real link from product to recipe, replacing free-text cost_reference over time.
ALTER TABLE products ADD COLUMN IF NOT EXISTS recipe_id TEXT REFERENCES recipes(id) ON DELETE SET NULL;

-- Snapshot every cost calculation so margin history never changes when ingredient prices move.
CREATE TABLE IF NOT EXISTS recipe_cost_snapshots (
  id TEXT PRIMARY KEY,
  recipe_version_id TEXT NOT NULL REFERENCES recipe_versions(id) ON DELETE CASCADE,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ingredient_cost NUMERIC(14,2) NOT NULL,
  packaging_cost  NUMERIC(14,2) NOT NULL,
  labour_cost     NUMERIC(14,2) NOT NULL,
  overhead_cost   NUMERIC(14,2) NOT NULL,
  total_cost      NUMERIC(14,2) NOT NULL,
  trigger         TEXT NOT NULL,            -- 'manual' | 'goods_receipt' | 'approval' | 'nightly'
  detail          JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_rcs_version_time ON recipe_cost_snapshots(recipe_version_id, computed_at DESC);

-- Unit conversions (owned by Optim_inventory.md; minimal form needed here).
CREATE TABLE IF NOT EXISTS inventory_unit_conversions (
  item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  from_unit TEXT NOT NULL, to_unit TEXT NOT NULL,
  factor NUMERIC(18,6) NOT NULL CHECK (factor > 0),
  PRIMARY KEY (item_id, from_unit, to_unit)
);

-- Permissions. Roles: role-admin / role-production exist today; role-finance is created in Optim_security_rbac.md.
INSERT INTO permissions (id, key) VALUES
  ('perm-recipes-view','recipes.view'), ('perm-recipes-edit','recipes.edit'),
  ('perm-recipes-approve','recipes.approve'), ('perm-recipes-cost','recipes.view_cost'),
  ('perm-cat-price','catalogue.change_price')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-' || r.id || '-' || p.id, r.id, p.id FROM roles r JOIN permissions p ON
  (r.id = 'role-admin') OR
  (r.id = 'role-production' AND p.key IN ('recipes.view','recipes.edit')) OR
  (r.id = 'role-finance'    AND p.key IN ('recipes.view','recipes.view_cost','catalogue.change_price'))
WHERE p.key IN ('recipes.view','recipes.edit','recipes.approve','recipes.view_cost','catalogue.change_price')
ON CONFLICT (role_id, permission_id) DO NOTHING;
```

`role_permissions` has a `UNIQUE (role_id, permission_id)` so the grant statement is safe to re-run.

**Backfill / data migration**

```ts
// server/scripts/backfill-recipes.ts  (run once, idempotent)
// 1. For each product with cost_reference like 'Recipe TC-XXX-Vn' and no recipe_id:
//    find a recipe whose name contains the code, else create an empty DRAFT recipe named after the product.
// 2. Set products.recipe_id.
// 3. Existing recipe_versions get status 'APPROVED' (one per recipe) so jobs keep working; others 'RETIRED'.
// 4. Print a report of products that still have no approved recipe -> staff fill them in via the new UI.
```

Do not invent quantities. Items must be entered by the baker; the backfill only creates the structure and a to-do list.

### API (direct Postgres repository)

```
GET    /catalogue/recipes?productId=            recipes.view
GET    /catalogue/recipes/:id                   recipes.view   (costs only if recipes.view_cost)
POST   /catalogue/recipes                       recipes.edit
POST   /catalogue/recipes/:id/versions          recipes.edit   (clones latest, status DRAFT)
PUT    /catalogue/recipe-versions/:vid          recipes.edit   (DRAFT only; replaces items)
POST   /catalogue/recipe-versions/:vid/submit   recipes.edit
POST   /catalogue/recipe-versions/:vid/approve  recipes.approve (not the creator)
GET    /catalogue/recipe-versions/:vid/cost     recipes.view_cost
POST   /catalogue/recipes/explode               production.schedule  -> planned consumption (below)
```

```ts
// server/services/recipe.service.ts
import { pool } from "../database/db.js";
import { ConflictError, NotFoundError, ValidationError } from "../utils/errors.js";

export interface PlannedLine {
  itemId: string; name: string; quantity: number; unit: string;
  unitCost: number; lineCost: number; allergens: string[];
}

/** Recipe x quantity x option multiplier -> planned ingredient lines in the INVENTORY unit. */
export async function explode(productId: string, qty: number, multiplier = 1): Promise<{
  recipeVersionId: string; lines: PlannedLine[]; ingredientCost: number;
}> {
  const { rows: [v] } = await pool.query(
    `SELECT rv.id, rv.wastage_percent, r.yield_quantity
       FROM recipes r JOIN recipe_versions rv ON rv.recipe_id = r.id AND rv.status = 'APPROVED'
      WHERE r.product_id = $1 AND r.is_active`, [productId]);
  if (!v) throw new ConflictError("No approved recipe for this product");

  const { rows } = await pool.query(
    `SELECT ri.ingredient_id, ii.name, ri.quantity, ri.unit, ri.expected_waste,
            ii.unit AS inv_unit, COALESCE(ii.cost,0) AS cost,
            COALESCE(c.factor, CASE WHEN ri.unit = ii.unit THEN 1 END) AS factor,
            COALESCE(ARRAY_AGG(ia.allergen) FILTER (WHERE ia.allergen IS NOT NULL), '{}') AS allergens
       FROM recipe_items ri
       JOIN inventory_items ii ON ii.id = ri.ingredient_id
  LEFT JOIN inventory_unit_conversions c
         ON c.item_id = ii.id AND c.from_unit = ri.unit AND c.to_unit = ii.unit
  LEFT JOIN ingredient_allergens ia ON ia.item_id = ii.id
      WHERE ri.recipe_version_id = $1
   GROUP BY ri.id, ii.id, c.factor`, [v.id]);

  const scale = (qty * multiplier) / Number(v.yield_quantity);
  const lines = rows.map((r): PlannedLine => {
    if (r.factor === null) throw new ValidationError(`No unit conversion ${r.unit}→${r.inv_unit} for ${r.name}`);
    const q = (Number(r.quantity) + Number(r.expected_waste)) * Number(r.factor) * scale;
    const quantity = Math.round(q * 1000) / 1000;
    return { itemId: r.ingredient_id, name: r.name, quantity, unit: r.inv_unit,
             unitCost: Number(r.cost), lineCost: Math.round(quantity * Number(r.cost)), allergens: r.allergens };
  });
  return { recipeVersionId: v.id, lines, ingredientCost: lines.reduce((n, l) => n + l.lineCost, 0) };
}
```

Approval enforces the maker–checker rule in code as well as in the database:

```ts
router.post("/recipe-versions/:vid/approve", required("recipes.approve"), async (req, res) => {
  const me = sessionUserId(req);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: [v] } = await client.query(`SELECT * FROM recipe_versions WHERE id=$1 FOR UPDATE`, [req.params.vid]);
    if (!v) throw new NotFoundError("Version not found");
    if (v.status !== "PENDING_APPROVAL") throw new ConflictError(`Cannot approve from ${v.status}`);
    if (v.created_by === me) throw new ConflictError("A different person must approve this recipe");
    await client.query(`UPDATE recipe_versions SET status='RETIRED' WHERE recipe_id=$1 AND status='APPROVED'`, [v.recipe_id]);
    await client.query(`UPDATE recipe_versions SET status='APPROVED', approved_by=$2, approved_at=now() WHERE id=$1`, [v.id, me]);
    await snapshotCost(client, v.id, "approval");
    await emitDomainEventTx(client, { type: "recipe.approved", entityType: "recipe_version", entityId: v.id, actorId: me });
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
});
```

### UI — new

**Catalogue → new tab "Recipes"** (between Products and Categories), permission-aware (`recipes.view`).

1. **Recipe list.** Table: product, active version, status badge (Draft / Pending / Approved / Retired), yield, **Cost per unit** (hidden without `recipes.view_cost`), **Margin %** (same), last approved date. Filter "Products without an approved recipe", with a count badge. This is the to-do list the backfill produces.
2. **Recipe editor** (full-page sheet, not a small dialog):
   - Header: product, version label, yield (`1 cake`, `24 cupcakes`), status.
   - Ingredient grid: inventory-item picker (search by name/SKU), quantity, unit (dropdown limited to units with a conversion), expected waste, notes, drag to reorder. The inventory unit and current cost appear read-only beside each row (cost column only with `recipes.view_cost`).
   - Side panel **Cost roll-up** (cost-permission only): ingredients, packaging, labour (minutes × hourly rate from settings), overhead %, **total**, selling price, **margin %** with a red/amber/green chip against the threshold in R5.
   - **Allergens** chips derived from ingredients (R6), read-only.
   - Buttons: Save draft, Submit for approval, and (for approvers who are not the creator) Approve / Reject with reason.
   - Version history drawer: each version, who approved, cost snapshot at approval, **Compare** two versions (diff of quantities and cost).
3. **Product dialog**: shows the linked recipe and its status; "Create recipe" shortcut when none.
4. **Baker view (Production)**: read-only recipe card without costs, scaled to the job (see Production touch point).

### UI — adjusted

- **Product card** (Products grid): add a small badge "No recipe" (amber) or "Margin 38%" (cost-permission only).
- **Variants tab**: replace the placeholder with the editor in R4.

### Cross-module changes

| Module | Change | How |
|---|---|---|
| **Production** (`Optim_production.md`) | On job creation, call `explode()` and store the **planned consumption** (`production_planned_items`). The job stores `recipe_version_id`. `recordMaterialsUsed` pre-fills from the plan, flags usage variance per line, and writes **one** cost row per job. The job sheet shows the scaled recipe. | New table `production_planned_items(job_id, item_id, qty, unit, unit_cost)`; change `createJobFromOrder`. Confirming an order with no approved recipe creates a "needs attention" item rather than silently continuing. |
| **Inventory** (`Optim_inventory.md`) | Reservations are made from the exploded plan (and must subtract other orders' reservations). Unit conversions table is maintained here. Removing or changing the unit of an item used by an approved recipe is blocked (the FK enforces delete; add an application check for unit change). | Reservation uses `available = physical − reserved`. |
| **Purchasing** (`Optim_purchasing.md`) | "Suggested purchases" = Σ planned items for confirmed orders − available stock − open PO quantities. | Query over `production_planned_items`. |
| **Finance** (`Optim_finance.md`) | Standard cost = latest approved snapshot. Delivered order posts COGS from **actual** consumption; the variance report compares actual with the snapshot (price, usage, yield). | `recipe_cost_snapshots` read by the COGS posting and `fact_jobs`. |
| **Orders / Quotations** | Quote and order screens show a margin chip to users with cost permission; selling below the margin floor needs the discount-approval permission. | `GET /catalogue/recipe-versions/:vid/cost` via a server-side check inside pricing, never exposed to Sales. |
| **Analytics** (`Optim_analytics.md`) | New facts: planned vs actual cost, margin by product, recipe cost trend. Metrics gated by `analytics.finance`. | `fact_jobs` columns `planned_cost`, `actual_cost`. |
| **Notifications/Audit** | Events `recipe.submitted`, `recipe.approved`, `recipe.retired`; notify approvers on submit; notify Admin when an order is confirmed for a product with no approved recipe. | `notification_rules` rows. |
| **RBAC** | `recipes.view`, `recipes.edit`, `recipes.approve`, `recipes.view_cost`. Cost is hidden from Sales and Delivery. | Migration above; middleware strips cost fields when `recipes.view_cost` is absent. |
| **Website** | None directly. Allergen output flows through R6. | n/a |

### Scenario — after the change

The Production Manager creates version v1.3 of the chocolate cake with 0.4 kg cocoa. The Owner (a different user) approves it. The next order confirmed for 2 chocolate cakes explodes to 0.8 kg cocoa plus waste, reserves it, and shows a shortage alert if available stock is 0.5 kg. The baker records 0.9 kg used. The variance report shows +0.1 kg usage and the cost is attributed to the job. Nobody could change v1.2's history.

---

## R4 — Variants and options with price and recipe scaling (fixes CR-5)

### Database

```sql
-- 024_options_pricing.sql
ALTER TABLE option_values
  ADD COLUMN IF NOT EXISTS price_delta       NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recipe_multiplier NUMERIC(8,3)  NOT NULL DEFAULT 1 CHECK (recipe_multiplier > 0),
  ADD COLUMN IF NOT EXISTS extra_cost        NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active            BOOLEAN       NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS display_order     INTEGER       NOT NULL DEFAULT 0;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS requires_quote BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS serves         TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS lead_time_hours INTEGER NOT NULL DEFAULT 24 CHECK (lead_time_hours >= 0);

-- option_definitions.entity_type/entity_id is polymorphic (no FK). Add an integrity check function or trigger,
-- or migrate to product_id NOT NULL for this release since only 'product' and 'variant' exist today.
CREATE INDEX IF NOT EXISTS idx_option_def_entity ON option_definitions(entity_type, entity_id);

-- Order lines keep structured selections (the text column remains for display and old rows).
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS selected_options JSONB NOT NULL DEFAULT '[]';
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS selected_options JSONB NOT NULL DEFAULT '[]';
ALTER TABLE order_proposal_items ADD COLUMN IF NOT EXISTS selected_options JSONB NOT NULL DEFAULT '[]';
-- Backfill: leave '[]'; old free-text stays in variant_options.

UPDATE products SET requires_quote = TRUE WHERE notes ILIKE '%requires enquiry%';
```

(Table names verified against `003_sales.sql` and `016_public_order_proposals.sql`: `order_items`, `quotation_items`, `order_proposal_items`.)

### Shared pricing function (single source of truth)

```ts
// server/services/pricing.service.ts
export interface LineInput { productId: string; quantity: number; optionValueIds?: string[] }
export interface PricedLine { productId: string; quantity: number; unitPrice: number; total: number;
                              selectedOptions: { id: string; label: string; priceDelta: number }[]; multiplier: number;
                              requiresQuote: boolean }

export async function priceLine(input: LineInput): Promise<PricedLine> {
  const { rows: [p] } = await pool.query(
    `SELECT id, base_price, requires_quote, active, archived, catalogue_visible FROM products WHERE id=$1`, [input.productId]);
  if (!p || p.archived || !p.active) throw new ValidationError("Product unavailable");
  const ids = input.optionValueIds ?? [];
  const { rows: opts } = ids.length ? await pool.query(
    `SELECT ov.id, ov.label, ov.price_delta, ov.recipe_multiplier, od.entity_id, od.is_mandatory
       FROM option_values ov JOIN option_definitions od ON od.id = ov.option_def_id
      WHERE ov.id = ANY($1) AND ov.active`, [ids]) : { rows: [] };
  if (opts.length !== ids.length) throw new ValidationError("Unknown or inactive option");
  if (opts.some((o) => o.entity_id !== p.id)) throw new ValidationError("Option does not belong to this product");
  // each mandatory definition must have exactly one selection (query omitted for brevity)
  const unit = Number(p.base_price) + opts.reduce((n, o) => n + Number(o.price_delta), 0);
  const multiplier = opts.reduce((n, o) => n * Number(o.recipe_multiplier), 1);
  return { productId: p.id, quantity: input.quantity, unitPrice: unit, total: unit * input.quantity,
           selectedOptions: opts.map((o) => ({ id: o.id, label: o.label, priceDelta: Number(o.price_delta) })),
           multiplier, requiresQuote: p.requires_quote };
}
```

### UI — new

- **Catalogue → Variants tab** (replaces the placeholder). Per product: list of option groups (Size, Flavour, Filling, Tiers, Message on cake). Each group: name, mandatory toggle, single/multi-select, ordered values. Each value row: label, **price adjustment (+UGX)**, **recipe multiplier** (e.g. 2 kg = 2.0 × the 1 kg recipe), extra cost (e.g. board and box), active toggle. A live **price preview** shows the price for any combination, and the cost/margin preview for cost-permission users.
- **"Requires quote"** toggle on the product dialog. When on, the website shows "Request a quote" instead of a price and an Order button.

### UI — adjusted

- **Sales → New order / quotation line editor**: option dropdowns replace the free-text "variant options" box; price fills from `priceLine()` and cannot be typed over without `orders.override_price` (`Optim_orders.md`).
- **Production job card and daily sheet**: show structured options ("Size: 2 kg · Flavour: Vanilla") rather than a text blob.

### Cross-module changes

| Module | Change | How |
|---|---|---|
| **Orders** | `POST /orders` and `/repeat` call `priceLine()` per line; store `selected_options`. Reject lines for `requiresQuote` products unless created from an accepted quotation. | `Optim_orders.md` O-3. |
| **Quotations** | Quote lines priced the same way; quote conversion copies `selected_options`. | `Optim_quotations.md` Q-3. |
| **Website / proposals** | `POST /public/order-proposals` accepts `optionValueIds` and prices on the server; `requiresQuote` products are routed to an enquiry. | `Optim_website.md` W-4. |
| **Production** | Recipe `multiplier` passes into `explode()`. | R3. |
| **Finance** | Invoice lines carry the option labels and the unit price used. | `Optim_finance.md` invoice lines. |
| **Analytics** | Popularity and margin by option (size, flavour). | `fact_order_lines.selected_options`. |
| **CRM** | Customer preferences are suggested from past `selected_options` (favourite flavour). | `Optim_crm.md`. |

---

## R5 — Cost roll-up and margin guard (fixes the margin half of CR-8)

### Behaviour

`snapshotCost(client, versionId, trigger)` computes ingredient (current `inventory_items.cost`), packaging, labour (`labour_minutes/60 × labour_rate` from settings) and overhead (`overhead_pct`), writes a `recipe_cost_snapshots` row and updates `recipe_versions.total_estimated_cost`. It runs on:

1. approval of a version;
2. **every goods receipt that changes an item's cost** (event `inventory.cost_changed`);
3. a nightly job (safety net).

```ts
// subscriber (event spine) — runs in the same transaction as the goods receipt when possible
on("inventory.cost_changed", async ({ itemId }) => {
  const { rows } = await pool.query(
    `SELECT DISTINCT rv.id FROM recipe_items ri
       JOIN recipe_versions rv ON rv.id = ri.recipe_version_id AND rv.status = 'APPROVED'
      WHERE ri.ingredient_id = $1`, [itemId]);
  for (const r of rows) {
    const snap = await snapshotCost(pool, r.id, "goods_receipt");
    const price = await sellingPriceFor(r.id);
    const margin = (price - snap.total) / price;
    if (margin < settings.minMargin) emit("recipe.margin_below_threshold", { versionId: r.id, margin });
  }
});
```

### Settings (new)

`settings`: `labour_rate_per_hour`, `min_margin_pct` (default 35), `price_alert_pct` (default 10). Edited in the Admin settings screen (see UI).

### UI — new

- **Catalogue → Margin watch** panel (cost-permission): products sorted by margin with a trend arrow (cost now vs 30 days ago) and a "Suggested price at target margin" column.
- **Settings → Costing**: labour rate, minimum margin, overhead default, alert thresholds.

### Cross-module changes

| Module | Change | How |
|---|---|---|
| **Inventory / Purchasing** | Goods receipt must update `inventory_items.cost` as a weighted average and emit `inventory.cost_changed`; a PO price more than 10% above last price raises a notification. | `Optim_inventory.md`, `Optim_purchasing.md`. |
| **Finance** | The same snapshot is the "standard cost" for variance. Dashboard card "Products below target margin". | `Optim_finance.md`. |
| **Notifications** | `recipe.margin_below_threshold` → Finance and Admin, severity warning, dedupe 24 h. | rule row. |
| **Analytics** | `margin_by_product` metric and cost trend line chart; export CSV. | `Optim_analytics.md`. |
| **Orders / Quotations** | Selling below the margin floor needs `orders.approve_discount`. | pricing check. |

---

## R6 — Allergens and product specification (fixes CR-7)

### Database

```sql
-- 025_allergens_specs.sql
CREATE TABLE IF NOT EXISTS ingredient_allergens (
  item_id  TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  allergen TEXT NOT NULL CHECK (allergen IN
    ('GLUTEN','EGGS','MILK','PEANUTS','TREE_NUTS','SOY','SESAME','FISH','SULPHITES')),
  PRIMARY KEY (item_id, allergen)
);
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS shelf_life_hours INTEGER,
  ADD COLUMN IF NOT EXISTS dietary_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;
-- Seed common allergens for flour, butter, eggs, cream, cocoa (check with your supplier labels, do not assume).
```

Derived allergens are computed from the approved recipe version, never typed on the product, so they cannot drift.

### UI

- **Inventory item dialog** (adjusted): "Allergens" multi-select (owner: `Optim_inventory.md`).
- **Recipe editor and product card** (new): allergen chips.
- **Order creation** (adjusted): if the customer has an allergy note (CRM) that matches a derived allergen, show a blocking confirmation "This cake contains EGGS. Customer notes: egg allergy."
- **Daily production sheet**: allergens printed per cake in bold.

### Cross-module changes

| Module | Change | How |
|---|---|---|
| **CRM** | Customer `allergies` (structured list) from `Optim_crm.md` is matched against derived allergens at order time. | `explode()` already returns `allergens`. |
| **Orders** | `allergen_acknowledged_by/at` on the order when a conflict was confirmed. | Column plus audit event. |
| **Production** | Sheet prints allergens; QC checklist item "allergen label attached". | `Optim_production.md`. |
| **Website** | Public product shows "Contains: eggs, milk" and dietary tags; order form lets customers state allergies, which creates a conflict flag. | `Optim_website.md`. |
| **Notifications** | `order.allergen_conflict` → Production Manager, requires acknowledgement. | rule row. |

---

## R7 — Lifecycle, price history and publish workflow (fixes CR-6)

### Database

```sql
-- 026_catalogue_lifecycle.sql
CREATE TABLE IF NOT EXISTS product_price_history (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_price NUMERIC(14,2) NOT NULL,
  new_price NUMERIC(14,2) NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (length(reason) >= 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pph_product_time ON product_price_history(product_id, effective_from DESC);

ALTER TABLE products ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
-- Backfill: everything currently visible counts as published now.
UPDATE products SET published_at = now() WHERE catalogue_visible AND published_at IS NULL;
```

### API

```ts
router.post("/products/:id/archive", required("catalogue.archive"), async (req, res) => {
  const id = String(req.params.id);
  const open = await pool.query(
    `SELECT (SELECT count(*) FROM order_items oi JOIN orders o ON o.id=oi.order_id
              WHERE oi.product_id=$1 AND o.status NOT IN ('COMPLETED_DELIVERED','CANCELLED'))::int AS orders,
            (SELECT count(*) FROM order_proposal_items i JOIN order_proposals p ON p.id=i.proposal_id
              WHERE i.product_id=$1 AND p.status='PENDING_REVIEW')::int AS proposals`, [id]);
  const { orders, proposals } = open.rows[0];
  if (orders + proposals > 0 && req.body?.force !== true)
    return res.status(409).json({ error: "Product is on open orders or proposals", orders, proposals });
  /* …archive, audit, emit product.archived… */
});
router.post("/products/:id/unarchive", required("catalogue.archive"), /* restores active, keeps hidden */);
router.post("/products/:id/publish",   required("catalogue.edit"),    /* requires image, price>0, description; sets published_at */);
router.get ("/products/:id/price-history", required("catalogue.view"), /* … */);
```

(Table and column names verified against `003_sales.sql`: `order_items.product_id`, `orders.status`. The status literals `COMPLETED_DELIVERED` and `CANCELLED` match the `OrderStatus` type in `database/types.ts` (verified).)

### UI

- **Product dialog**: "Publish to website" is a separate action with a checklist (image present, price set, description, category visible). Status chips: Draft, Published, Hidden, Archived.
- **Archive confirmation** lists the open orders/proposals blocking it, with links.
- **Price history tab** inside the product dialog (date, old → new, who, reason); chart of price over time.
- **Catalogue list filters**: status, category, "no recipe", "no image", "below target margin"; sort by display order; drag to reorder `display_order`; "Featured" star (replaces `slice(0, 6)` on the website).
- Bulk actions: hide/show, change category (with confirmation).

### Cross-module changes

| Module | Change | How |
|---|---|---|
| **Orders / Quotations** | Existing documents keep their stored `unitPrice`. Price changes never rewrite them. | Document the rule, add test "changing basePrice does not change existing order totals". |
| **Website** | Reads `featured` and `displayOrder`; a product with `published_at` null never appears. | `isPublic` also checks `published_at`. |
| **Finance / Analytics** | Margin-by-period uses the price in force at order time (`product_price_history`). | join on `effective_from`. |
| **Audit** | `product.published`, `product.unpublished`, `product.archived`, `product.price_changed`. | event types. |

---

## R8 — Product media (fixes the image gap in CR-6)

The catalogue stores a single `image` string that must be an absolute URL. Move to uploaded files: `POST /catalogue/products/:id/images` (multipart, `catalogue.edit`), limits 5 MB, `image/jpeg|png|webp` verified by magic bytes, re-encoded and resized server-side, stored under object storage (or `/uploads` with a static route in development), with a `product_images(id, product_id, url, alt, display_order)` table. Full implementation, including the website consumption, is in `Optim_website.md` W-7 so it is written once.

Catalogue-side UI changes: gallery in the product dialog with drag to reorder, an alt-text field per image, and a "set as cover" action. `products.image` stays as the cover URL for backwards compatibility.

---

# PART C — CONSOLIDATED CHANGES

## C.1 New and adjusted UI at a glance

| Screen | New | Adjusted |
|---|---|---|
| Catalogue → Products | Margin/“No recipe” badges, status chips, publish checklist, price-history tab, gallery | `ProductDialog` (type select, validation, price reason), archive confirmation, filters and bulk actions |
| Catalogue → **Recipes** | List, editor, version history, compare, approvals | n/a (new tab) |
| Catalogue → Variants | Option-group editor with price and recipe multiplier | Replaces placeholder |
| Catalogue → Margin watch | Margin table and trend | n/a |
| Settings → Costing | Labour rate, margin floor, thresholds | n/a |
| Sales (orders, quotes) | n/a | Option dropdowns, server-priced lines, margin chip |
| Production | Planned-materials panel, scaled recipe card | Job dialog prefilled from plan |
| Inventory item | Allergens field | Unit-conversion editor |

## C.2 Migration summary

| File | Contents |
|---|---|
| `022_catalogue_hardening.sql` | SKU unique (case-insensitive), price check, public description |
| `023_recipes_costing.sql` | Recipe status/costing columns, FKs, one-approved index, snapshots, unit conversions, permissions and grants |
| `024_options_pricing.sql` | Option price/multiplier, `requires_quote`, structured selections |
| `025_allergens_specs.sql` | Allergens, shelf life, tags, featured, order |
| `026_catalogue_lifecycle.sql` | Price history, `published_at` |

Run them in order in a staging copy first; every statement is idempotent (`IF NOT EXISTS` / `ON CONFLICT`). Take a backup before `VALIDATE CONSTRAINT`.

## C.3 Tests to add (in this order)

1. Public endpoints never return `costReference`, `notes`, `sku`, `productionEnabled`; hidden categories and their products are absent.
2. Duplicate SKU returns 409 and leaves the in-memory list unchanged.
3. `PATCH` with an unknown or protected field (`id`, `createdAt`) returns 400.
4. Price change without `catalogue.change_price` returns 403; with it but no reason returns 400; history row is written.
5. `explode()` scales by quantity and multiplier, applies unit conversions, and throws when no approved recipe exists.
6. Recipe approval by the creator returns 409; a second approved version retires the first (unique index holds).
7. Changing `basePrice` does not alter existing order totals.
8. Archive with an open order returns 409 with counts.

## C.4 Rollout and risk

- **Feature flag** the recipe requirement: for the first two weeks, confirming an order for a product without an approved recipe **warns** (needs-attention item) rather than blocks. Switch to blocking once the "no recipe" list is empty.
- **Data entry is the real work.** The backfill cannot create quantities. Plan a session with the head baker to enter the first six recipes; the "Products without an approved recipe" filter is the checklist.
- **Do not** remove `costReference` yet. Keep it read-only until every product has `recipe_id`, then drop it in a later migration.

## C.5 Open points I could not verify

- `ingredient_defaults` (table in `002`): I found no route or store code that uses it, so I left it alone; decide whether to drop it or use it to seed new inventory items.
- Runtime behaviour: I did not run the app.
