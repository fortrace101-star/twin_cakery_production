import { store } from "../database/store.js";
import { notificationService } from "./notification.service.js";

/**
 * Low-stock alerts (E3). Callers invoke this after any stock decrement with the
 * item's stock *before* the change; an alert is published only when the item
 * crosses downward through its reorder level (previous > reorder, now <= reorder)
 * so repeated consumptions while already low do not spam the feed. A crossing to
 * zero or below is raised as CRITICAL, otherwise HIGH.
 */
export function publishLowStockAlert(
  itemId: string,
  previousStock: number,
  session: { userId: string; role: string; isAdmin: boolean },
): boolean {
  const item = store.inventoryItems().find((i) => i.id === itemId);
  if (!item) return false;
  const reorder = item.reorderLevel || 0;
  const stock = item.physicalStock || 0;
  if (!(previousStock > reorder && stock <= reorder)) return false;
  const outOfStock = stock <= 0;
  notificationService.publishEvent(
    {
      eventTypeId: "LowStockAlert",
      title: outOfStock ? `${item.name} is out of stock` : `${item.name} is running low`,
      message: outOfStock
        ? `${item.name} has reached 0 ${item.unit} (reorder level ${reorder} ${item.unit}). Raise a purchase requirement now.`
        : `${item.name} is at ${stock} ${item.unit}, at or below its reorder level of ${reorder} ${item.unit}.`,
      priority: outOfStock ? "CRITICAL" : "HIGH",
      entityType: "inventory_item",
      entityId: item.id,
      actionUrl: "/workspace/inventory",
      deepLink: "/workspace/inventory",
      createdBy: session.userId,
    },
    session,
  );
  return true;
}
