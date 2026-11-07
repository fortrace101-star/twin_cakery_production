import { store } from "../database/store.js";
export const costingService = {
    getJobCost(jobId) {
        const db = store.db;
        const consumptions = (db.productionConsumption ?? db.productionConsumptions ?? []).filter((c) => c.jobId === jobId);
        const wastage = (db.productionWastage ?? []).filter((w) => w.jobId === jobId);
        const labour = (db.productionLabour ?? []).filter((l) => l.jobId === jobId);
        const costRows = (db.productionCosts ?? []).filter((r) => r.jobId === jobId);
        const ingredientCost = consumptions.reduce((s, c) => s + Number(c.actualCost || c.unitCost * c.quantity || 0), 0);
        const wastageCost = wastage.reduce((s, w) => s + Number(w.cost || 0), 0);
        const labourCost = labour.reduce((s, l) => s + Number(l.cost || 0), 0) ||
            costRows.reduce((s, r) => s + Number(r.labourCost || 0), 0);
        const overheadCost = costRows.reduce((s, r) => s + Number(r.overheadCost || 0), 0);
        const actualCost = ingredientCost + wastageCost + labourCost + overheadCost;
        return { jobId, ingredientCost, wastageCost, labourCost, overheadCost, actualCost };
    },
};
//# sourceMappingURL=costing.service.js.map