/**
 * Low-stock alerts (E3). Callers invoke this after any stock decrement with the
 * item's stock *before* the change; an alert is published only when the item
 * crosses downward through its reorder level (previous > reorder, now <= reorder)
 * so repeated consumptions while already low do not spam the feed. A crossing to
 * zero or below is raised as CRITICAL, otherwise HIGH.
 */
export declare function publishLowStockAlert(itemId: string, previousStock: number, session: {
    userId: string;
    role: string;
    isAdmin: boolean;
}): boolean;
