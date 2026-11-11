import { store } from "../database/store.js";

export const costingService = {
  getJobCost(jobId: string) {
    const db = store.db as any;
    const consumptions = (db.productionConsumption ?? db.productionConsumptions ?? []).filter((c: any) => c.jobId === jobId);
    const wastage = (db.productionWastage ?? []).filter((w: any) => w.jobId === jobId);
    const labour = (db.productionLabour ?? []).filter((l: any) => l.jobId === jobId);
    const costRows = (db.productionCosts ?? []).filter((r: any) => r.jobId === jobId);
    const ingredientCost = consumptions.reduce((s: number, c: any) => s + Number(c.actualCost || c.unitCost * c.quantity || 0), 0);
    const wastageCost = wastage.reduce((s: number, w: any) => s + Number(w.cost || 0), 0);
    const labourCost =
      labour.reduce((s: number, l: any) => s + Number(l.cost || 0), 0) ||
      costRows.reduce((s: number, r: any) => s + Number(r.labourCost || 0), 0);
    const overheadCost = costRows.reduce((s: number, r: any) => s + Number(r.overheadCost || 0), 0);
    const actualCost = ingredientCost + wastageCost + labourCost + overheadCost;
    return { jobId, ingredientCost, wastageCost, labourCost, overheadCost, actualCost };
  },
};
