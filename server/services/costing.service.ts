import { store } from "../database/store";

export const costingService = {
  getJobCost(jobId: string) {
    const consumptions = store.db.productionConsumptions?.filter((c: any) => c.jobId === jobId) || [];
    const wastage = store.db.productionWastage?.filter((w: any) => w.jobId === jobId) || [];
    const labour = store.db.productionLabour?.filter((l: any) => l.jobId === jobId) || [];
    const ingredientCost = consumptions.reduce((s: number, c: any) => s + Number(c.actualCost || c.unitCost * c.quantity || 0), 0);
    const wastageCost = wastage.reduce((s: number, w: any) => s + Number(w.cost || 0), 0);
    const labourCost = labour.reduce((s: number, l: any) => s + Number(l.cost || 0), 0);
    const overheadCost = 0;
    const actualCost = ingredientCost + wastageCost + labourCost + overheadCost;
    return { jobId, ingredientCost, wastageCost, labourCost, overheadCost, actualCost };
  },
};
