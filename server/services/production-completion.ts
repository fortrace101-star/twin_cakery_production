import type { ProductionJob } from "../database/types.js";

/**
 * Where "Mark Production Complete" sends a job (Production_Job_Complete_Bug_Fix
 * §4.1). A job that belongs to an order hands the cake to the Decorating
 * station — status DECORATING, stage QC, progress 80 — where "Set to Ready"
 * picks it up. A stock job with no linked order is finished goods.
 */
export function completionTarget(
  hasLinkedOrder: boolean,
): Pick<ProductionJob, "status" | "stage" | "progress"> {
  return hasLinkedOrder
    ? { status: "DECORATING", stage: "QC", progress: 80 }
    : { status: "DONE", stage: "DONE", progress: 100 };
}
