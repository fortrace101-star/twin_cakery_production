import type { ServerOrder, ServerProductionJob } from '@/lib/api';
import type { Order } from '@/components/erp/data';
import { orderStageTone, type StatusTone } from '@/lib/theme-tokens';

/**
 * Shared production-stage helpers for the Twin Cakery production module.
 *
 * Single source of truth for mapping a production job / order to a board
 * column, a human readable stage label, and its UI tone. Duplicated logic
 * for this mapping is removed from `production-view.tsx` and `module-table.tsx`.
 *
 * Board columns (Jobs board is one column per status):
 *   queued   –PENDING / SCHEDULED / READY_FOR_PRODUCTION / CONFIRMED
 *   baking   –IN_PRODUCTION
 *   decorating –DECORATING / QC passed (→ ready) — QC pending at `QC`
 *   ready    –READY_FOR_DELIVERY / READY / COMPLETED / COMPLETE
 */

export type ProductionStage =
  | "queued"
  | "baking"
  | "decorating"
  | "ready";

/** Local `Order` from data.ts — has `status` (string) and `id` but not server-side order fields. */
export type LocalOrder = { id: string; status: string };

/** Resolve the board column for a production job (with its linked order). */
export function orderStage(order: ServerOrder | Order | undefined, job: ServerProductionJob | undefined): ProductionStage {
  return orderStageInternal(order, job);
}

/** Alias for `orderStage(order, job)` — board column for the job. */
export function orderStation(order: ServerOrder | Order | undefined, job: ServerProductionJob | undefined): ProductionStage {
  return orderStageInternal(order, job);
}

function orderStageInternal(order: ServerOrder | Order | undefined, job: ServerProductionJob | undefined): ProductionStage {
  const status = String((job?.status || "").toUpperCase());
  const orderStatus = String((order?.status ?? "").toUpperCase());

  // An order leaving production is shown in the column matching the job;
  // orders at Ready / Delivering / Collected are shown in "ready".
  if (orderStatus === "READY_FOR_DELIVERY" || orderStatus === "READY" || orderStatus === "AWAITING_COLLECTION") {
    return "ready";
  }
  if (status === "COMPLETED" || status === "COMPLETE" || status === "DONE") {
    return "ready";
  }
  if (status === "IN_PRODUCTION") {
    return "baking";
  }
  if (status === "DECORATING" || status === "QUALITY_CHECK" || status === "READY_FOR_QUALITY") {
    return "decorating";
  }
  if (status === "PENDING" || status === "SCHEDULED" || status === "READY_FOR_PRODUCTION" || status === "CONFIRMED") {
    return "queued";
  }
  if (status === "READY_FOR_DELIVERY" || status === "READY") {
    return "ready";
  }
  return "queued";
}

/** The job's own stage name for the Jobs board column label. */
export function jobStage(job: ServerProductionJob | undefined): ProductionStage {
  const status = String((job?.status || "").toUpperCase());
  if (status === "IN_PRODUCTION") return "baking";
  if (status === "DECORATING" || status === "QUALITY_CHECK") return "decorating";
  if (status === "READY_FOR_DELIVERY" || status === "READY") return "ready";
  if (status === "COMPLETED" || status === "COMPLETE" || status === "DONE") return "ready";
  if (status === "PENDING" || status === "SCHEDULED" || status === "READY_FOR_PRODUCTION" || status === "CONFIRMED") return "queued";
  return "queued";
}

/** Human readable stage label shown in the Jobs board columns. */
export function stageLabel(stage: ProductionStage): string {
  switch (stage) {
    case "queued":
      return "Queued";
    case "baking":
      return "Baking";
    case "decorating":
      return "Decorating";
    case "ready":
      return "Ready";
  }
}

/** UI tone class for a board column stage (mirrors ORDER_STAGE_TONES). */
export function stageTone(stage: ProductionStage): StatusTone {
  switch (stage) {
    case "queued":
      return "default" as StatusTone;
    case "baking":
      return "blue";
    case "decorating":
      return "orange";
    case "ready":
      return "green";
  }
}
