import { ConflictError, ValidationError, NotFoundError } from "../utils/errors.js";
import { store } from "../database/store.js";
import { notificationService } from "./notification.service.js";
import type { Order, OrderStatus, User, OrderItem, ProductionJob, OrderStatusHistory } from "../database/types.js";

export class BusinessService {
  validateOrderStatusTransition(current: OrderStatus, next: OrderStatus): void {
    const allowed: Record<OrderStatus, OrderStatus[]> = {
      INQUIRY: ["QUOTATION", "AWAITING_CONFIRMATION", "CONFIRMED", "CANCELLED"],
      QUOTATION: ["AWAITING_CONFIRMATION", "CANCELLED"],
      AWAITING_CONFIRMATION: ["CONFIRMED", "CANCELLED"],
      CONFIRMED: ["PRODUCTION_REVIEW", "CANCELLED"],
      PRODUCTION_REVIEW: ["READY_FOR_PRODUCTION", "CANCELLED"],
      READY_FOR_PRODUCTION: ["IN_PRODUCTION", "CANCELLED"],
      IN_PRODUCTION: ["QUALITY_CHECK", "CANCELLED"],
      QUALITY_CHECK: ["READY_FOR_DELIVERY", "REWORK_REQUIRED", "CANCELLED"],
      REWORK_REQUIRED: ["QUALITY_CHECK", "CANCELLED"],
      READY_FOR_DELIVERY: ["OUT_FOR_DELIVERY", "CANCELLED"],
      OUT_FOR_DELIVERY: ["AWAITING_PICKUP", "CANCELLED"],
      AWAITING_PICKUP: ["COMPLETED", "CANCELLED"],
      COMPLETED: [],
      CANCELLED: [],
    };
    if (!allowed[current].includes(next)) {
      throw new ConflictError(`Cannot transition order status from ${current} to ${next}`);
    }
  }

  async confirmOrder(order: Order, changedBy: string): Promise<{ order: Order; history: OrderStatusHistory; job: ProductionJob }> {
    this.validateOrderStatusTransition(order.status, "CONFIRMED");
    const now = new Date().toISOString();

    const items = order.items || [];
    const history: OrderStatusHistory = {
      id: `osh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      orderId: order.id,
      previousStatus: order.status,
      newStatus: "CONFIRMED",
      changedBy,
      reason: "Admin confirmed order",
      timestamp: now,
      createdAt: now,
      updatedAt: now,
    };

    const job: ProductionJob = store.createProductionJob({
      orderId: order.id,
      customerId: order.customerId,
      productId: order.items?.[0]?.productId || "",
      variantOptions: order.items?.[0]?.variantOptions || "",
      quantity: order.items?.[0]?.quantity || 0,
      recipeVersion: order.items?.[0]?.recipeVersion || "v1.0",
      requiredBy: order.requiredBy,
      requiredAt: order.requiredAt,
      notes: "Created from confirmed order",
    });

    for (const item of items) {
      if (item.quantity > 0) {
        store.adjustInventory(item.productId, -item.quantity, item.unit || "unit", "PRODUCTION_CONSUMPTION", `Pre-reservation for ${order.id}`, changedBy, item.unitPrice, "Manufacturing reservation");
      }
    }

    const notificationEvent = {
      eventTypeId: "OrderConfirmed" as const,
      title: `Order ${order.orderNumber} confirmed`,
      message: `Order #${order.orderNumber} has been confirmed by ${changedBy}.`,
      priority: "MEDIUM",
      entityType: "order",
      entityId: order.id,
      actionUrl: `/workspace/${order.id}`,
      deepLink: `/workspace/${order.id}`,
      createdBy: changedBy,
    };
    notificationService.publishEvent(notificationEvent, { userId: changedBy, role: changedBy, isAdmin: true });

    const updatedOrder = {
      ...order,
      status: "CONFIRMED",
      updatedAt: now,
    };

    store.createAuditLog({
      orderId: order.id,
      actor: changedBy,
      action: "order:confirmed",
      previousStatus: order.status,
      newStatus: "CONFIRMED",
      reason: "Admin confirmed order",
      timestamp: now,
    });

    return { order: updatedOrder, history, job };
  }

  cancelOrder(order: Order, changedBy: string, reason: string): { order: Order; history: OrderStatusHistory } {
    this.validateOrderStatusTransition(order.status, "CANCELLED");
    const now = new Date().toISOString();
    const history: OrderStatusHistory = {
      id: `osh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      orderId: order.id,
      previousStatus: order.status,
      newStatus: "CANCELLED",
      changedBy,
      reason,
      timestamp: now,
      createdAt: now,
      updatedAt: now,
    };
    const updatedOrder = { ...order, status: "CANCELLED", updatedAt: now };
    store.createAuditLog({
      orderId: order.id,
      actor: changedBy,
      action: "order:cancelled",
      previousStatus: order.status,
      newStatus: "CANCELLED",
      reason,
      timestamp: now,
    });
    return { order: updatedOrder, history };
  }

  submitOrder(order: Order, changedBy: string): { order: Order; history: OrderStatusHistory } {
    this.validateOrderStatusTransition(order.status, "AWAITING_CONFIRMATION");
    const now = new Date().toISOString();
    const history: OrderStatusHistory = {
      id: `osh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      orderId: order.id,
      previousStatus: order.status,
      newStatus: "AWAITING_CONFIRMATION",
      changedBy,
      reason: "Awaiting proprietor confirmation",
      timestamp: now,
      createdAt: now,
      updatedAt: now,
    };
    const updatedOrder = { ...order, status: "AWAITING_CONFIRMATION", updatedAt: now };
    store.createAuditLog({
      orderId: order.id,
      actor: changedBy,
      action: "order:status_changed",
      previousStatus: order.status,
      newStatus: "AWAITING_CONFIRMATION",
      reason: "Awaiting proprietor confirmation",
      timestamp: now,
    });
    return { order: updatedOrder, history };
  }

  reserveStock(jobId: string, userId: string): void {
    const job = store.productionJobs().find((j) => j.id === jobId);
    if (!job) throw new NotFoundError("Production job not found");
    const items = job.orderId ? store.orders().find((o) => o.id === job.orderId)?.items : [];
    if (!items?.length) throw new NotFoundError("No items linked to this production job");

    for (const item of items) {
      const inventoryItem = store.inventoryItems().find((i) => i.id === item.productId);
      if (!inventoryItem) throw new NotFoundError(`Inventory item not found: ${item.productId}`);
      const available = inventoryItem.physicalStock || 0;
      if (item.quantity > available) {
        throw new ConflictError(`Insufficient stock for ${inventoryItem.name}. Available: ${available}, Required: ${item.quantity}`);
      }
      const prev = store.stockReservations().filter((r) => r.itemId === inventoryItem.id && r.orderId === job.orderId);
      const reserved = prev.reduce((sum, r) => sum + r.quantity, 0);
      if (reserved + item.quantity > available) {
        throw new ConflictError(`Reservation would exceed available stock for ${inventoryItem.name}`);
      }
      store.stockReservations().push({
        id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        itemId: inventoryItem.id,
        quantity: item.quantity,
        unit: inventoryItem.unit,
        orderId: job.orderId,
        reference: job.orderId,
        reservedAt: new Date().toISOString(),
      });
    }
  }

  markProductionStarted(jobId: string, userId: string): ProductionJob {
    const job = store.productionJobs().find((j) => j.id === jobId);
    if (!job) throw new NotFoundError("Production job not found");
    if (job.status !== "PENDING" && job.status !== "READY_FOR_PRODUCTION") {
      throw new ConflictError(`Cannot start production from status ${job.status}`);
    }
    job.status = "IN_PRODUCTION";
    job.stage = "PRODUCE";
    job.progress = 20;
    store.updateProductionJob(jobId, job);
    return job;
  }

  completeProduction(jobId: string, userId: string): ProductionJob {
    const job = store.productionJobs().find((j) => j.id === jobId);
    if (!job) throw new NotFoundError("Production job not found");
    if (job.status !== "IN_PRODUCTION") {
      throw new ConflictError(`Cannot complete from status ${job.status}`);
    }
    job.status = "READY_FOR_QUALITY";
    job.stage = "QUALITY";
    job.progress = 80;
    store.updateProductionJob(jobId, job);

    const notificationEvent = {
      eventTypeId: "ProductionCompleted" as const,
      title: "Production completed",
      message: `Production job #${jobId} is complete and ready for quality check.`,
      priority: "MEDIUM",
      entityType: "production_job",
      entityId: jobId,
      actionUrl: `/workspace/production/jobs/${jobId}`,
      deepLink: `/workspace/production/jobs/${jobId}`,
      createdBy: userId,
    };
    notificationService.publishEvent(notificationEvent, { userId, role: userId, isAdmin: true });

    return job;
  }

  recordQualityCheck(
    jobId: string,
    result: "PASS" | "FAIL",
    checkedBy: string,
    issues: string,
    notes: string,
    reworkRequired: boolean,
    reworkCost: number,
    wastageCaused: number,
  ): { job: ProductionJob; check: import("../database/types.js").QualityCheck } {
    const job = store.productionJobs().find((j) => j.id === jobId);
    if (!job) throw new NotFoundError("Production job not found");
    const check: import("../database/types.js").QualityCheck = store.createQualityCheck({
      jobId,
      checkedBy,
      checkedAt: new Date().toISOString(),
      issues,
      notes,
      reworkRequired,
      reworkCost,
      wastageCaused,
    });
    if (result === "PASS") {
      job.status = "READY_FOR_DELIVERY";
      job.stage = "DELIVER";
      job.progress = 100;
      store.updateProductionJob(jobId, job);
      notificationService.publishEvent({
        eventTypeId: "QualityPassed" as const,
        title: "Quality check passed",
        message: `Quality check passed for order ${job.orderId}. Ready for delivery.`,
        priority: "MEDIUM",
        entityType: "production_job",
        entityId: jobId,
        actionUrl: `/workspace/production/jobs/${jobId}`,
        deepLink: `/workspace/production/jobs/${jobId}`,
        createdBy: checkedBy,
      }, { userId: checkedBy, role: checkedBy, isAdmin: true });
    } else {
      job.status = "REWORK_REQUIRED";
      job.stage = "QUALITY";
      job.progress = 50;
      store.updateProductionJob(jobId, job);
      notificationService.publishEvent({
        eventTypeId: "QualityFailed" as const,
        title: "Quality check failed",
        message: `Quality check failed for order ${job.orderId}. Rework required.`,
        priority: "HIGH",
        entityType: "production_job",
        entityId: jobId,
        actionUrl: `/workspace/production/jobs/${jobId}`,
        deepLink: `/workspace/production/jobs/${jobId}`,
        createdBy: checkedBy,
      }, { userId: checkedBy, role: checkedBy, isAdmin: true });
    }
    return { job, check };
  }

  recordWastage(jobId: string, itemId: string, quantity: number, unit: string, reason: string, cost: number, recordedBy: string): void {
    const job = store.productionJobs().find((j) => j.id === jobId);
    if (!job) throw new NotFoundError("Production job not found");
    store.createProductionWastage({
      jobId,
      itemId,
      quantity,
      unit,
      reason,
      cost,
      recordedBy,
    });
    const items = store.orders().find((o) => o.id === job.orderId)?.items || [];
    const item = items.find((i) => i.productId === itemId);
    if (item) {
      store.adjustInventory(itemId, -quantity, unit, "WASTAGE", `Rework wastage for ${job.orderId}`, recordedBy, cost, `Wastage: ${reason}`);
    }
  }

  recordConsumption(jobId: string, userId: string): void {
    const job = store.productionJobs().find((j) => j.id === jobId);
    if (!job) throw new NotFoundError("Production job not found");
    if (job.status !== "IN_PRODUCTION") throw new ConflictError("Production job is not in production");

    const items = store.orders().find((o) => o.id === job.orderId)?.items || [];
    for (const item of items) {
      const inventoryItem = store.inventoryItems().find((i) => i.id === item.productId);
      if (!inventoryItem) continue;
      const reserved = store.stockReservations().filter((r) => r.itemId === inventoryItem.id && r.orderId === job.orderId);
      const reservedQty = reserved.reduce((sum, r) => sum + r.quantity, 0);
      const consume = Math.min(reservedQty, item.quantity);
      if (consume <= 0) continue;
      store.adjustInventory(inventoryItem.id, -consume, item.unit || "unit", "PRODUCTION_CONSUMPTION", `Consumption for ${job.orderId}`, userId, item.unitPrice, "Production consumption recorded");
      for (const r of reserved) {
        if (r.itemId === inventoryItem.id && r.orderId === job.orderId) {
          store.stockReservations().splice(store.stockReservations().indexOf(r), 1);
        }
      }
      const actualCost = consume * (item.unitPrice || 0);
      store.createProductionConsumption({
        jobId,
        itemId: inventoryItem.id,
        quantity: consume,
        unit: item.unit || "unit",
        recipeVersion: item.recipeVersion || "v1.0",
        unitCost: item.unitPrice || 0,
        actualCost,
        notes: "Recorded during production",
      });
      const cost: import("../database/types.js").ProductionCost = store.createProductionCost({
        jobId,
        ingredientCost: actualCost,
        packagingCost: 0,
        labourCost: 0,
        overheadCost: 0,
        total: actualCost,
        status: "ACTUAL",
      });
    }
    job.status = "QUALITY_CHECK";
    job.stage = "QUALITY";
    job.progress = 60;
    store.updateProductionJob(jobId, job);

    const order = store.orders().find((o) => o.id === job.orderId);
    if (order) {
      notificationService.publishEvent({
        eventTypeId: "ProductionStarted" as const,
        title: "Production recorded",
        message: `Production consumption recorded for order ${order.orderNumber}.`,
        priority: "LOW",
        entityType: "production_job",
        entityId: jobId,
        actionUrl: `/workspace/production/jobs/${jobId}`,
        deepLink: `/workspace/production/jobs/${jobId}`,
        createdBy: userId,
      }, { userId, role: userId, isAdmin: true });
    }
  }

  prepareOrderForProduction(orderId: string, userId: string): { job: ProductionJob } {
    const order = store.orders().find((o) => o.id === orderId);
    if (!order) throw new NotFoundError("Order not found");
    if (order.status !== "READY_FOR_PRODUCTION" && order.status !== "CONFIRMED" && order.status !== "PRODUCTION_REVIEW") {
      throw new ConflictError(`Order must be in a production-ready status to prepare`);
    }
    const job = store.createProductionJob({
      orderId: order.id,
      customerId: order.customerId,
      productId: order.items?.[0]?.productId || "",
      variantOptions: order.items?.[0]?.variantOptions || "",
      quantity: order.items?.[0]?.quantity || 0,
      recipeVersion: order.items?.[0]?.recipeVersion || "v1.0",
      requiredBy: order.requiredBy,
      requiredAt: order.requiredAt,
      stage: "CHECK_INVENTORY",
      progress: 10,
    });
    store.updateProductionJob(job.id, { status: "PENDING", stage: "CHECK_INVENTORY", progress: 10 });
    return { job };
  }
}

export const businessService = new BusinessService();
