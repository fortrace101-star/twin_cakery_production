# Optim — Architecture (state machine, transactions, in-memory store, tests, repo hygiene)

**Owner of:** the shared plumbing every other `Optim_*.md` file depends on.
**Companion files:** `Optim_security_rbac.md` (permission middleware), `Optim_notifications_audit.md` (event spine), `Optim_deliveries.md`, and the module files.

> Evidence for this document comes from the repository zip: `server/routes/*.ts`, `server/services/business.service.ts`, `server/database/store.ts`, `server/database/db.ts`, `server/index.ts` and `server/migrations/*.sql`. The app was not run, so runtime behaviour is inferred from reading code. Snippets are written to fit the existing names (`store`, `withTransaction`, `NotFoundError`, `ConflictError`) but must be compiled and adapted.

---

# PART A — ASSESSMENT

## A1. The in-memory store is the structural risk
**What the code does.** Routes mutate arrays on `store.db.*` (for example `store.db.payments`, `store.db.orders`) and call `store.persist()`. `server/index.ts` holds each response until `flush()` finishes writing back to Postgres (it returns 500 "Failed to persist changes" if the flush fails). `server/index.ts` imports `ready, flush` from `./database/index.new.js`, so `index.new.ts` is the live write-back layer.

**Why it matters (scenarios).**
1. *Lost update.* Two staff open order TC-481234. Sales records a UGX 50,000 deposit while Production confirms the order. Both requests read the same in-memory object. Whichever write-back runs last can overwrite the other's `paymentStatus` or `status`.
2. *Divergence after a crash.* The process dies halfway through a flush. Postgres has the payment row but not the order's new `payment_status`, or the reverse. Nothing detects it.
3. *Memory growth.* Every row of every table lives in the Node heap, including notifications (four rows per user per event). The heap grows with the business.
4. *No multi-step atomicity.* "Complete delivery → record payment → close order → archive job" is four separate in-memory mutations with `try { … } catch {}` between them. There is no rollback.

## A2. Status changes are scattered and unguarded
Status writes happen in at least these places: `PATCH /orders/:id` (any status accepted), `POST /production/jobs/:id/start` and `/complete` (no precondition), `PATCH /deliveries/:id`, `store.updateOrderStatus`, `businessService.advanceOrderTo*`. There is a dual state on orders (`status` and `station`), a dead block in `orders.ts` that builds a `statusMap` and never applies it, and `station: "decorating"` is written with `as any`.

**Scenario.** A salesperson with `orders.confirm` PATCHes an order straight from `AWAITING_CONFIRMATION` to `COMPLETED_DELIVERED`. No job, no reservation, no payment check; the CRM follow-up banner fires and `archiveCompletedJob` is attempted.

## A3. Silent failures
`try { … } catch {}` wraps business steps in `orders.ts` (job creation, archiving), `production.ts` (`advanceOrderToReadyForDelivery`, station writes), and `businessService.markOrderPaid` callers. `POST /orders/:id/confirm` swallows any `confirmOrder` error and falls back to a bare status update that skips job creation and reservation.

## A3b. Authentication is not applied globally
`server/index.ts` imports `requireAuth` (line 6) and mounts only `attachAuth` (line 44), and `routes/api.ts` mounts each router without auth middleware. Each router therefore depends on its own `required()` copy; any route that forgets it (for example `POST /purchasing/suppliers`) is open. The fix (`apiRouter.use(requireAuth)` after the public/auth routes, plus one shared `requirePermission`) is owned by `Optim_security_rbac.md`.

## A4. No server-side input validation
Handlers destructure `req.body || {}` and trust the values (`orders.ts` POST takes `total`, `paymentStatus`, `createdBy`; `payments.ts` takes `receivedBy`). Zod is installed in the frontend only; `server/package.json` has no validation library, no helmet, no test runner.

## A5. Tests
All 11 test files are in `erp-interface-design/src/test/`. The server has none (`server/scripts/test-*.mjs` are manual flow scripts).

## A6. Repository hygiene
Present in the zip: `.env`, `server/erp.db`, 15 `backups/pre-wipe-*.sql`, `*.err`, `*.log`, `*.out`, `server/tmp-check.js`, `erp-interface-design/{build*.txt,temp*.txt,tmp.txt,files.txt,*.bak,tsc*_output.txt}`, `_vitest.err`, `check-*.ts`, `seed-*.ts` at the root. Duplicate/dead pairs: `database/index.ts` vs `index.new.ts`, `store.ts` vs `store.legacy.ts`. Migrations have two files numbered `020_` (`020_users_email_empty_placeholder.sql` and `020_production_fixed_costs.sql`).

---

# PART B — OPTIMIZATION, CORRECTION AND IMPROVEMENT

## B1. One transition table for every lifecycle (orders, jobs, deliveries, quotes, POs)

### B1.1 New module `server/domain/state-machine.ts`
```ts
import { ConflictError, ForbiddenError } from "../utils/errors.js";

export type Entity = "order" | "job" | "delivery" | "quotation" | "purchase_order";

export interface Transition {
  from: string[];
  to: string;
  permission: string;                 // must hold this to move
  guard?: (ctx: TxContext) => void | Promise<void>;   // throws ConflictError
  effects?: (ctx: TxContext) => Promise<void>;        // runs in the SAME transaction
  event: string;                      // domain event type, e.g. "order.confirmed"
}

export const TRANSITIONS: Record<Entity, Record<string, Transition>> = {
  order: {
    confirm:  { from: ["AWAITING_CONFIRMATION", "INQUIRY"], to: "CONFIRMED",
                permission: "orders.confirm", event: "order.confirmed" },
    cancel:   { from: ["AWAITING_CONFIRMATION", "CONFIRMED", "READY_FOR_PRODUCTION"], to: "CANCELLED",
                permission: "orders.cancel", event: "order.cancelled" },
    // job-driven moves (system only; no HTTP route can request these):
    startProduction: { from: ["CONFIRMED", "READY_FOR_PRODUCTION"], to: "IN_PRODUCTION",
                permission: "system", event: "order.in_production" },
    markReady:       { from: ["IN_PRODUCTION"], to: "READY_FOR_DELIVERY",
                permission: "system", event: "order.ready" },
  },
  job: {
    start:    { from: ["PENDING", "READY_FOR_PRODUCTION"], to: "IN_PRODUCTION", permission: "production.start", event: "job.started" },
    finish:   { from: ["IN_PRODUCTION", "REWORK_REQUIRED"], to: "READY_FOR_QUALITY", permission: "production.complete", event: "job.finished" },
    qcPass:   { from: ["READY_FOR_QUALITY"], to: "READY_FOR_DELIVERY", permission: "production.quality_check", event: "job.qc_passed" },
    qcFail:   { from: ["READY_FOR_QUALITY"], to: "REWORK_REQUIRED", permission: "production.quality_check", event: "job.qc_failed" },
  },
  // delivery / quotation / purchase_order tables are defined in their own Optim files
  delivery: {}, quotation: {}, purchase_order: {},
};
```

### B1.2 The one function every route calls
```ts
// server/domain/transition.ts
import { withTransaction, type TxClient } from "../database/db.js";
import { TRANSITIONS, type Entity } from "./state-machine.js";
import { emit } from "../services/events.js";           // Optim_notifications_audit.md §B1
import { rbac } from "../services/rbac.service.js";

export async function transition(entity: Entity, id: string, action: string,
  actor: { userId: string; ip?: string }, payload: Record<string, unknown> = {}) {
  const t = TRANSITIONS[entity][action];
  if (!t) throw new ConflictError(`Unknown action ${entity}.${action}`);
  if (t.permission !== "system") await rbac.requirePermission(actor.userId, t.permission);

  return withTransaction(async (tx: TxClient) => {
    // row lock: two simultaneous completes serialise here
    const { rows } = await tx.query(`SELECT * FROM ${table(entity)} WHERE id = $1 FOR UPDATE`, [id]);
    const row = rows[0];
    if (!row) throw new NotFoundError(`${entity} not found`);
    if (!t.from.includes(row.status))
      throw new ConflictError(`Cannot ${action} ${entity} from ${row.status}`);
    const ctx = { tx, row, actor, payload };
    await t.guard?.(ctx);
    await tx.query(`UPDATE ${table(entity)} SET status = $2, updated_at = now() WHERE id = $1`, [id, t.to]);
    await t.effects?.(ctx);
    await emit(tx, { type: t.event, entity, entityId: id, from: row.status, to: t.to, actor, data: payload });
    return { ...row, status: t.to };
  });
}
const table = (e: Entity) => ({ order: "orders", job: "production_jobs", delivery: "deliveries",
  quotation: "quotations", purchase_order: "purchase_orders" }[e]);
```
`FOR UPDATE` solves the "two simultaneous completes" case without any in-memory locking.

### B1.3 Unified impact — what changes where when this lands
| Layer / module | Change | How |
|---|---|---|
| Orders (`routes/orders.ts`) | Replace PATCH-with-status and the swallowed `confirmOrder` fallback | Routes call `transition("order", id, "confirm" \| "cancel", …)`; see `Optim_orders.md` |
| Production (`routes/production.ts`) | `/start`, `/complete`, `/quality-check` call `transition("job", …)`; order follows job as a transition **effect** | see `Optim_production.md` |
| Deliveries | Delivery transitions registered in the same table | see `Optim_deliveries.md` |
| Quotations, Purchasing | `send`, `accept`, `expire`, `approve`, `receive` registered | see `Optim_quotations.md`, `Optim_purchasing.md` |
| RBAC | Each transition names its permission; new permissions are inserted by migrations | see `Optim_security_rbac.md` |
| Events/Audit/Notifications | One `emit()` per transition, same transaction | `Optim_notifications_audit.md` |
| Analytics | Milestones derive from the emitted events | `Optim_analytics.md` |
| Database | `status` CHECK constraints (B1.4) | migration `022_status_constraints.sql` |
| Front end | Buttons render from `GET /meta/transitions` filtered by the user's permissions, so UI and server agree | B1.5 |

### B1.4 Migration — status constraints and the dual-state cleanup
```sql
-- 022_status_constraints.sql
ALTER TABLE orders ADD CONSTRAINT orders_status_chk CHECK (status IN
  ('INQUIRY','AWAITING_CONFIRMATION','CONFIRMED','PRODUCTION_REVIEW','READY_FOR_PRODUCTION',
   'IN_PRODUCTION','READY_FOR_DELIVERY','COMPLETED_DELIVERED','CANCELLED')) NOT VALID;
ALTER TABLE production_jobs ADD CONSTRAINT jobs_status_chk CHECK (status IN
  ('PENDING','READY_FOR_PRODUCTION','IN_PRODUCTION','READY_FOR_QUALITY','REWORK_REQUIRED',
   'READY_FOR_DELIVERY','COMPLETED','ARCHIVED')) NOT VALID;
-- Validate after checking existing data:  SELECT status, count(*) FROM orders GROUP BY 1;
-- ALTER TABLE orders VALIDATE CONSTRAINT orders_status_chk;
```
**Dual state.** Decide that `orders.status` is authoritative. Derive `station` in the read model (`station = f(status)`) and stop writing it; remove the `as any` writes in `production.ts` and the dead `statusMap` block in `orders.ts`. Confirm the actual status list against `server/database/types.ts` before running the constraint.

### B1.5 UI element — transition-driven action bar (new)
A shared `<ActionBar entity="order" id=… />` component in `erp-interface-design/src/components/erp/ui.tsx`:
- Fetches allowed actions (`GET /api/v1/meta/transitions?entity=order&id=…`) which the server computes from current status ∩ user permissions.
- Renders one button per action; destructive ones (cancel) open the existing `dialogs.tsx` confirm dialog with a required reason.
- Shows a disabled button with a tooltip ("Needs `orders.cancel`") instead of hiding when the user lacks permission but the action is otherwise legal. The server remains the gate.

## B2. Transactions and moving off the in-memory store (incremental)
`database/db.ts` already exports `withTransaction`. Do not rewrite the store in one go.

1. **Phase 1 — money and lifecycle paths:** payments, order status, delivery completion, job transitions, stock movements. Write them as repository functions that run SQL inside `withTransaction`.
2. **Phase 2 — a read-through cache bypass:** after a repository write, reload the affected rows into `store.db` (or evict them) so the remaining in-memory readers see current data. This lets old and new code coexist.
3. **Phase 3 — reads:** move list endpoints (orders, payments, analytics) to SQL with `LIMIT/OFFSET` or keyset paging; retire `paginate()` over whole arrays.
4. **Phase 4 — remove** `store.persist()` and the response-holding flush middleware once no route mutates `store.db`.

```ts
// server/repositories/payments.repo.ts  (phase 1 example)
export async function insertPayment(tx: TxClient, p: NewPayment) {
  const { rows } = await tx.query(
    `INSERT INTO payments (id, order_id, amount, method, reference, received_by, notes, idempotency_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`, [...]);
  return rows[0] ?? (await tx.query(`SELECT * FROM payments WHERE idempotency_key=$1`, [p.idempotencyKey])).rows[0];
}
```
Money-column details live in `Optim_finance.md`.

**Split the big files while doing it:** `store.ts` (2,562 lines) → `repositories/{orders,payments,inventory,crm,staff}.repo.ts`; `business.service.ts` (900 lines) → `services/{orders,production,finance,inventory}.service.ts`. Move code, do not rewrite it, and keep the `store` facade delegating until the last caller is gone.

## B3. Request validation and hardening
```bash
cd server && npm i zod helmet && npm i -D vitest supertest @types/supertest
```
```ts
// server/middleware/validate.ts
import { z, type ZodTypeAny } from "zod";
export const validate = <T extends ZodTypeAny>(schema: T): RequestHandler => (req, res, next) => {
  const r = schema.safeParse(req.body);
  if (!r.success) return res.status(400).json({ error: "Invalid request", issues: r.error.flatten() });
  req.body = r.data;           // whitelisted: unknown keys stripped by .strict()/.strip()
  next();
};
```
- Every action gets its own schema, so `PATCH /orders/:id` can no longer carry `total`, `paymentStatus` or `createdBy` (details in `Optim_orders.md`).
- `app.use(helmet())` and the CORS origin list belong to `Optim_security_rbac.md`; wire them in `server/index.ts`.
- Add `X-Request-Id` and put it in `domain_events.correlation_id` so one HTTP action ties to all its side effects.

## B4. Server tests first, then refactor
Add `server/vitest.config.ts` and a throwaway test database (`DATABASE_URL_TEST`). Order of priority:
1. Transition table: every illegal `from` returns 409.
2. Permissions: for each route, a user without the permission gets 403 (generate this from the route list).
3. Payments: idempotency, overpayment, concurrent writes.
4. Stock reservation: two orders cannot reserve the same flour.
5. Settlement flows (deliveries).

```ts
it("two simultaneous completes create one payment", async () => {
  const [a, b] = await Promise.allSettled([complete(id), complete(id)]);
  expect([a.status, b.status].sort()).toEqual(["fulfilled", "rejected"]);
  expect(await countPayments(orderId)).toBe(1);
});
```
Add a `.github/workflows/ci.yml` that runs `tsc -p server`, `vitest run` for server and `erp-interface-design`.

## B5. Repository hygiene (do this before sharing the repo anywhere)
```gitignore
# add to .gitignore
.env
*.db
backups/
*.err
*.log
*.out
tmp*.txt
temp*.txt
build*.txt
*.bak
dist-server/
files.txt
```
```bash
git rm -r --cached backups server/erp.db server/*.err server/*.out server/tmp-check.js \
  erp-interface-design/{build*.txt,temp*.txt,tmp.txt,*.bak,tsc*output.txt,vitest.txt}
```
- The backups are `pre-wipe-*.sql` dumps and may hold customer data. If the repository was ever pushed, rewrite history (`git filter-repo`) and **rotate** the database password and any secrets in `.env`.
- Delete `database/index.ts` or `index.new.ts` (keep the one `server/index.ts` imports — currently `index.new.ts`) and `store.legacy.ts`, after a repo-wide import check (`grep -rn "store.legacy\|database/index.js" server`).
- Renumber the duplicate `020_` migration only if neither has been applied; otherwise leave the filenames and make `migrate.ts` track by full filename in `_migrations` (verify it already does).
- Move `erp-interface-design/docs/tmp_write.py`, `fix.py`, `fix.js`, `temp_gen.js` out of the product tree.

## B6. Rollout order for this file
1. B5 hygiene and secret rotation. 2. B3 validation + helmet. 3. B4 test harness. 4. B1 transition module on orders and jobs. 5. B2 phase 1 for payments. 6. Remaining phases module by module.
