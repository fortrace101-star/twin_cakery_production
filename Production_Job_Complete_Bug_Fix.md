# Fix: "Mark Production Complete" sends the job to Queued and leaves the order in Baking

Build checked: `twin_cakery_production-main__5_`
Files: `server/routes/production.ts`, `server/services/business.service.ts`, `erp-interface-design/src/components/erp/production-view.tsx`

> Method note: this diagnosis comes from reading the code, not from running the app. Step 1 of section 5 confirms it against your data.

---

## 1. What was reported

On mobile, a job in Baking was marked complete with **Mark Production Complete**. Expected: the job and its order both move to **Decorating**. Actual:
- the **job** appeared in **Queued**;
- the **order** stayed in **Baking**;
- the job dialog (PC and mobile) shows **no action buttons**, not even Start Production, even though the job sits in the Queued column.

## 2. The actual issue (in one paragraph)

Completing a baking job sets its status to **`DONE`**, a status the Production screens do not know. The Jobs board treats every unknown status as "Queued", and the dialog only offers buttons for the statuses it knows, so a `DONE` job is shown in Queued with nothing to click. The completion code also never moves the order to the Decorating station, so the order stays in Baking.

## 3. How it happens, step by step

| Step | What the code does | Where |
|---|---|---|
| 1 | Starting a job (`POST /jobs/:id/start` or `startProductionForOrder`) sets `status: IN_PRODUCTION` and **`stage: "PRODUCE"`** | `routes/production.ts` line ~70; `business.service.ts` `startProductionForOrder` |
| 2 | Marking complete calls `completeProduction()`, which **chooses the next status from the job's `stage`**: stage `DECORATE` → status `DECORATING`; **any other stage → status `DONE`** (stage `DONE`, progress 100) | `business.service.ts` `completeProduction` (~lines 344–380) |
| 3 | Every normal baking job has stage `PRODUCE`, so it always takes the second branch and becomes **`DONE`** | same |
| 4 | `completeProduction()` does **not** change the order. Order status stays `IN_PRODUCTION`, and the order's `station` is never set to `decorating` | same |
| 5 | The Jobs board's `getColumnForJob()` knows `PENDING / SCHEDULED / READY_FOR_PRODUCTION` (queued), `IN_PRODUCTION` (baking), `DECORATING`, `READY_FOR_DELIVERY` and a few older ones. `DONE` matches none, so it reaches the last line, **`return "queued"`** | `production-view.tsx` ~lines 424–448 |
| 6 | The dialog shows **Start Production** only for `PENDING / SCHEDULED / READY_FOR_PRODUCTION`, **Mark Production Complete** only for `IN_PRODUCTION`, and **Set to Ready** only for `DECORATING`. `DONE` matches none, so no button appears | `production-view.tsx` ~lines 755–757 |
| 7 | The Schedule board's `getStationForOrder()` finds no decorating signal (the job is `DONE`, the order station is not `decorating`), then sees order status `IN_PRODUCTION`, so it returns **baking** | `production-view.tsx` ~lines 211–250 |

Why it looks like a mobile issue: it isn't. The server decides the status, so PC would behave the same. Mobile is just where it was first tried.

Why it used to work: the earlier version of `/jobs/:id/complete` set the job to the quality-check status itself and set the order's station to `decorating`. When that logic moved into `completeProduction()`, the stage-based branching was added and the order update was dropped. The new "Set to Ready" flow (job must be `DECORATING`) then has no way to be reached.

## 4. The fix

### 4.1 Server: `completeProduction()` (the real fix)
For a job that belongs to an order, completing baking must move the job to Decorating and the order to the Decorating station. Replace the stage branch with:

```ts
const order = store.orders().find((o) => o.id === job.orderId);
if (order) {
  // Baking finished: job and order move to the Decorating station together.
  job.status = "DECORATING";
  job.stage = "QC";
  job.progress = 80;
  store.updateOrder(order.id, { station: "decorating" } as any);
} else {
  // Stock job with no customer order: finished goods.
  job.status = "DONE";
  job.stage = "DONE";
  job.progress = 100;
}
```
- Keep the existing audit-log entry (previous status `IN_PRODUCTION`, new status `DECORATING`) and the notification.
- Save the job and the order change together, and do not change the order's status (it stays `IN_PRODUCTION` until the job is set to Ready).
- "Set to Ready" (`POST /jobs/:id/ready`) already requires `DECORATING` and then moves the order to Ready, so it works once jobs reach Decorating.

### 4.2 UI: stop hiding unknown statuses (safety net)
In `production-view.tsx`:
1. `getColumnForJob()`: replace the final `return "queued"` with a visible fallback (for example, show the job with an "Unknown status: DONE" badge in a separate "Needs attention" list, or in the column of its order). An unknown status should never look like a queued job.
2. Job dialog: when no action matches the job's status, show a short message ("No action is available for status DONE") instead of an empty footer.
3. `getStationForOrder()`: treat the order as Decorating when its job is `DECORATING`, which it already does; no change needed beyond the server fix.

### 4.3 Tests to add
- Start a job, complete it: job is `DECORATING` (stage `QC`), order station is `decorating`, order status is still `IN_PRODUCTION`.
- Then Set to Ready: job is `READY_FOR_DELIVERY`, order is `READY_FOR_DELIVERY`.
- A stock job with no order completes to `DONE` without errors.
- UI: a job with an unknown status is not shown in Queued.
- Both boards place the same job and its order in the same column after each step.

## 5. Repair the job that is stuck now (do this first)

1. **Find affected jobs:** jobs with status `DONE` whose order is still `IN_PRODUCTION`.
   ```sql
   SELECT j.id, j.order_id, j.status, j.stage, o.status AS order_status
   FROM production_jobs j JOIN orders o ON o.id = j.order_id
   WHERE j.status = 'DONE' AND o.status = 'IN_PRODUCTION';
   ```
   If this returns the job you completed, the diagnosis is confirmed.
2. **Repair them:** set each job to `status = 'DECORATING'`, `stage = 'QC'`, `progress = 80`, and set its order's `station = 'decorating'`.
3. **Check the column names first** (see `004_production.sql` and the orders table); the SQL above is a template.
4. **Stop the server before running SQL and start it again after.** The app keeps its data in memory and writes it to the database, so a change made while it runs can be overwritten.
5. After the repair the job shows in Decorating on both boards, and **Set to Ready** appears in the dialog.

## 6. Order of work

1. Repair the stuck job(s) (section 5).
2. Ship the server fix (4.1) with its tests (4.3).
3. Ship the UI safety net (4.2).
4. Re-test the full flow on mobile and PC: Confirmed → Baking → Decorating → Set to Ready → Awaiting Pickup.

## 7. Side notes

- `POST /jobs/:id/quality-check` and the QC-fail path are still in the server (`routes/production.ts`), although the plan replaced the quality check with "Set to Ready". Not part of this bug; track it in `Production_Layout_Optimization.md`.
- Jobs already in `DONE` for other reasons (for example stock jobs) should stay as they are; only jobs tied to an order that is still in production need the repair.
- Open question: do you have production jobs that are not linked to a customer order (stock baking)? If yes, the `else` branch in 4.1 keeps them working; if not, it can be removed.
