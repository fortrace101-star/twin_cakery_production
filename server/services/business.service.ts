import { ConflictError, ValidationError, NotFoundError } from "../utils/errors.js";
import { store } from "../database/store.js";
import type { Patch } from "../database/store.js";
import { notificationService } from "./notification.service.js";
import { publishLowStockAlert } from "./stock-alerts.js";
import type { Order, OrderStatus, User, OrderItem, ProductionJob, ProductionConsumption, OrderStatusHistory, NotificationPriority } from "../database/types.js";

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
      // Fulfilment branch: every order becomes Awaiting Collection first.
      // Pickup/collection orders complete straight from there; home-delivery
      // orders go In Transit first, then complete (mirrors routes/deliveries.ts).
      READY_FOR_DELIVERY: ["AWAITING_COLLECTION", "CANCELLED"],
      AWAITING_COLLECTION: ["IN_TRANSIT", "COMPLETED_DELIVERED", "CANCELLED"],
      IN_TRANSIT: ["COMPLETED_DELIVERED", "CANCELLED"],
      COMPLETED_DELIVERED: [],
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
    // Persist the status move + history (updateOrderStatus writes both the row
    // and the history entry and returns them). confirmOrder previously
    // returned an in-memory copy only — the CONFIRMED status vanished on
    // restart while the bare job row survived, leaving phantom jobs.
    const persisted = store.updateOrderStatus(order.id, "CONFIRMED", changedBy, "Admin confirmed order");
    const updatedOrder = persisted?.order ?? {
      ...order,
      status: "CONFIRMED" as OrderStatus,
      updatedAt: now,
    };
    const persistedHistory = persisted?.history ?? history;

    for (const item of items) {
      if (item.quantity > 0) {
        const previousStock = store.inventoryItems().find((i) => i.id === item.productId)?.physicalStock ?? 0;
        store.adjustInventory(item.productId, -item.quantity, item.unit || "unit", "PRODUCTION_CONSUMPTION", `Pre-reservation for ${order.id}`, changedBy, item.unitPrice, "Manufacturing reservation");
        publishLowStockAlert(item.productId, previousStock, { userId: changedBy, role: changedBy, isAdmin: true });
      }
    }

    const notificationEvent = {
      eventTypeId: "OrderConfirmed" as const,
      title: `Order ${order.orderNumber} confirmed`,
      message: `Order #${order.orderNumber} has been confirmed by ${changedBy}.`,
      priority: "MEDIUM" as NotificationPriority,
      entityType: "order",
      entityId: order.id,
      actionUrl: `/workspace/${order.id}`,
      deepLink: `/workspace/${order.id}`,
      createdBy: changedBy,
    };
    notificationService.publishEvent(notificationEvent, { userId: changedBy, role: changedBy, isAdmin: true });

    store.createAuditLog({
      orderId: order.id,
      actor: changedBy,
      action: "order:confirmed",
      previousStatus: order.status,
      newStatus: "CONFIRMED",
      reason: "Admin confirmed order",
      timestamp: now,
    });

    return { order: updatedOrder, history: persistedHistory, job };
  }

  /**
   * Post-delivery customer follow-up (CRM). Raised the moment an order reaches
   * Completed / Delivered: an in-app notification asks the admin to follow up,
   * and the Customers & CRM module shows a sidebar badge until the follow-up is
   * documented (orders.followUpCompletedAt stamped via PATCH /orders/:id).
   */
  requestCustomerFollowUp(order: Order, changedBy: string): void {
    const customer = store.customers().find((c) => c.id === order.customerId);
    const name = customer?.name ?? order.orderNumber;
    const notification = store.createNotification({
      eventTypeId: "OrderCompleted",
      title: "Customer follow-up requested",
      message: `Order ${order.orderNumber} for ${name} is Completed / Delivered. Follow up with the customer and document it in Customers & CRM.`,
      priority: "MEDIUM",
      entityType: "order",
      entityId: order.id,
      actionUrl: "/workspace/crm",
      deepLink: "/workspace/crm",
      createdBy: changedBy,
    });
    // Deliver the request in-app to every admin (proprietor) account.
    for (const admin of store.users().filter((u) => u.isAdmin)) {
      store.createNotificationRecipient({
        notificationId: notification.id,
        userId: admin.id,
        deliveryChannel: "IN_APP",
        createdAt: notification.createdAt,
      });
    }
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
    const updatedOrder = { ...order, status: "CANCELLED" as OrderStatus, updatedAt: now };
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
    const updatedOrder = { ...order, status: "AWAITING_CONFIRMATION" as OrderStatus, updatedAt: now };
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
    store.updateProductionJob(jobId, job as unknown as Patch);
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
    store.updateProductionJob(jobId, job as unknown as Patch);

    const notificationEvent = {
      eventTypeId: "ProductionCompleted" as const,
      title: "Production completed",
      message: `Production job #${jobId} is complete and ready for quality check.`,
      priority: "MEDIUM" as NotificationPriority,
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
      store.updateProductionJob(jobId, job as unknown as Patch);
      notificationService.publishEvent({
        eventTypeId: "QualityPassed" as const,
        title: "Quality check passed",
        message: `Quality check passed for order ${job.orderId}. Ready for delivery.`,
        priority: "MEDIUM" as NotificationPriority,
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
      store.updateProductionJob(jobId, job as unknown as Patch);
      notificationService.publishEvent({
        eventTypeId: "QualityFailed" as const,
        title: "Quality check failed",
        message: `Quality check failed for order ${job.orderId}. Rework required.`,
        priority: "HIGH" as NotificationPriority,
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
      const previousStock = store.inventoryItems().find((i) => i.id === itemId)?.physicalStock ?? 0;
      store.adjustInventory(itemId, -quantity, unit, "WASTAGE", `Rework wastage for ${job.orderId}`, recordedBy, cost, `Wastage: ${reason}`);
      publishLowStockAlert(itemId, previousStock, { userId: recordedBy, role: recordedBy, isAdmin: true });
    }
  }

  /**
   * Manually record materials (ingredients) used for a production job — the
   * "used materials" entry the job dialog submits. Each accepted entry
   * deducts stock (PRODUCTION_CONSUMPTION transaction), releases matching
   * reservations, writes a production_consumption row (recipe snapshot +
   * actual cost) and fires low-stock alerts; one ACTUAL cost row rolls up
   * the submission. Every entry is validated before the first write, so a
   * 409 never leaves stock half-deducted.
   * (The older recordConsumption below stays unwired — it derives entries
   * from order items and force-advances the job; this is the manual path.)
   */
  recordMaterialsUsed(
    jobId: string,
    userId: string,
    entries: Array<{ itemId: string; quantity: number; notes?: string }>,
  ): ProductionConsumption[] {
    const job = store.productionJobs().find((j) => j.id === jobId);
    if (!job) throw new NotFoundError("Production job not found");
    if (job.status !== "IN_PRODUCTION" && job.status !== "REWORK_REQUIRED") {
      throw new ConflictError(`Cannot record materials from status ${job.status}`);
    }
    if (!entries.length) throw new ValidationError("At least one material entry is required");

    const resolved = entries.map((e) => {
      const qty = Number(e.quantity);
      if (!e.itemId || !Number.isFinite(qty) || qty <= 0) {
        throw new ValidationError("Each material needs an itemId and a positive quantity");
      }
      const item = store.inventoryItems().find((i) => i.id === e.itemId);
      if (!item) throw new NotFoundError(`Inventory item not found: ${e.itemId}`);
      const available = item.physicalStock || 0;
      if (qty > available) {
        throw new ConflictError(`Insufficient stock for ${item.name}. Available: ${available}, Required: ${qty}`);
      }
      return { itemId: e.itemId, qty, notes: e.notes || "", item };
    });

    const created: ProductionConsumption[] = [];
    let ingredientCost = 0;
    for (const { itemId, qty, notes, item } of resolved) {
      const unitCost = item.cost || 0;
      const actualCost = qty * unitCost;
      const previousStock = item.physicalStock || 0;
      store.adjustInventory(itemId, -qty, item.unit, "PRODUCTION_CONSUMPTION", `Materials used for ${job.orderId}`, userId, unitCost, notes || "Materials used");
      publishLowStockAlert(itemId, previousStock, { userId, role: userId, isAdmin: true });
      // Release matching reservations so planned stock stops counting against availability.
      const reserved = store.stockReservations().filter((r) => r.itemId === itemId && r.orderId === job.orderId);
      for (const r of reserved) {
        const idx = store.stockReservations().indexOf(r);
        if (idx >= 0) store.stockReservations().splice(idx, 1);
      }
      created.push(store.createProductionConsumption({
        jobId,
        itemId,
        quantity: qty,
        unit: item.unit,
        recipeVersion: job.recipeVersion,
        unitCost,
        actualCost,
        notes: notes || "Recorded during production",
      }));
      ingredientCost += actualCost;
    }
    store.createProductionCost({
      jobId,
      ingredientCost,
      packagingCost: 0,
      labourCost: 0,
      overheadCost: 0,
      total: ingredientCost,
      status: "ACTUAL",
    });
    store.persist();
    return created;
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
      const previousStock = inventoryItem.physicalStock || 0;
      store.adjustInventory(inventoryItem.id, -consume, item.unit || "unit", "PRODUCTION_CONSUMPTION", `Consumption for ${job.orderId}`, userId, item.unitPrice, "Production consumption recorded");
      publishLowStockAlert(inventoryItem.id, previousStock, { userId, role: userId, isAdmin: true });
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
    store.updateProductionJob(jobId, job as unknown as Patch);

    const order = store.orders().find((o) => o.id === job.orderId);
    if (order) {
      notificationService.publishEvent({
        eventTypeId: "ProductionStarted" as const,
        title: "Production recorded",
        message: `Production consumption recorded for order ${order.orderNumber}.`,
        priority: "LOW" as NotificationPriority,
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
    if (order.status !== "READY_FOR_PRODUCTION" && order.status !== "CONFIRMED" && order.status !== "PRODUCTION_REVIEW" && order.status !== "IN_PRODUCTION") {
      throw new ConflictError(`Order must be in a production-ready status to prepare`);
    }
    // Idempotent: an order already carrying a job reuses it instead of
    // spawning duplicates (covers the PATCH retry + confirm paths).
    const existing = store.productionJobs().find((j) => j.orderId === order.id);
    if (existing) return { job: existing };
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

  /**
   * Backfill pass — every order in the production pipeline must own a
   * Production Job, or the Jobs board reads empty while the order already
   * says "Confirmed" / "In production". Covers orders stranded by the old
   * status-only PATCH (which never created jobs); runs on boot and on every
   * GET /production/jobs so the board self-heals no matter which write path
   * missed. Idempotent: orders that already carry a job are skipped.
   */
  reconcileProductionJobs(changedBy = "system"): number {
    const pipelineStatuses = ["CONFIRMED", "PRODUCTION_REVIEW", "READY_FOR_PRODUCTION", "IN_PRODUCTION"];
    let created = 0;
    for (const order of store.orders()) {
      if (!pipelineStatuses.includes(order.status)) continue;
      if (store.productionJobs().some((j) => j.orderId === order.id)) continue;
      try {
        this.prepareOrderForProduction(order.id, changedBy);
        created += 1;
      } catch {
        /* A malformed order must never stall the board. */
      }
    }
    if (created > 0) store.persist();
    return created;
  }
}

export const businessService = new BusinessService();
