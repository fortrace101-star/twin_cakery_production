import { describe, expect, it } from "vitest";
import { completionTarget } from "../services/production-completion.js";

describe("PROD: Mark Production Complete target", () => {
  it("moves an order-linked job to Decorating (QC, 80%)", () => {
    expect(completionTarget(true)).toEqual({ status: "DECORATING", stage: "QC", progress: 80 });
  });

  it("moves a stock job with no order to finished goods", () => {
    expect(completionTarget(false)).toEqual({ status: "DONE", stage: "DONE", progress: 100 });
  });

  it("never returns DONE for a job that belongs to an order", () => {
    // Regression: the old stage branch sent every PRODUCE job to DONE, which
    // the boards read as Queued and which left the order in Baking.
    expect(completionTarget(true).status).not.toBe("DONE");
  });
});
