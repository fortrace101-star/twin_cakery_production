import { store } from "../database/store.js";
import type { Patch } from "../database/store.js";
import type {
  Notification,
  NotificationRecipient,
  NotificationPreference,
  NotificationTemplate,
  NotificationPriority,
  User,
} from "../database/types.js";

export type EventSource = "order" | "quotation" | "inquiry" | "customer" | "production" | "inventory" | "purchasing" | "delivery" | "payment" | "feedback" | "expense" | "catalogue" | "settings";

export type NotificationEventType =
  | "OrderConfirmed"
  | "OrderCompleted"
  | "QuotationAccepted"
  | "InquiryCreated"
  | "InquiryResolved"
  | "CustomerComplaint"
  | "FeedbackRecorded"
  | "PaymentReceived"
  | "StockShortageDetected"
  | "LowStockAlert"
  | "ProductionStarted"
  | "ProductionCompleted"
  | "GoodsReceived"
  | "PurchaseRequirementCreated"
  | "QualityFailed"
  | "QualityPassed"
  | "DeliveryDue"
  | "DeliveryDispatched"
  | "DeliveryCompleted"
  | "ExpenseCreated"
  | "ExpenseApproved"
  | "OrderCancelled"
  | "OrderRejected"
  | "SettingsUpdated"
  | "CatalogueCreated"
  | "CatalogueUpdated"
  | "CatalogueArchived"
  | "JobCompleted";

export type NotificationChannel_ = "IN_APP" | "WHATSAPP" | "EMAIL" | "SMS";

export interface NotificationEvent {
  eventTypeId: NotificationEventType;
  title: string;
  message: string;
  priority: NotificationPriority;
  entityType: string;
  entityId: string;
  actionUrl: string | null;
  deepLink: string | null;
  createdBy: string | null;
}

const TEMPLATES: Record<NotificationEventType, { [K in NotificationChannel_]: { title: string; message: string } }> = {
  OrderConfirmed: {
    IN_APP: { title: "Order confirmed", message: "A customer order has been confirmed and is ready for production." },
    WHATSAPP: { title: "Order confirmed", message: "Order {{orderNumber}} has been confirmed by the proprietor." },
    EMAIL: { title: "Order confirmed", message: "Your order {{orderNumber}} has been confirmed. Production will begin shortly." },
    SMS: { title: "Order confirmed", message: "Your order {{orderNumber}} has been confirmed." },
  },
  OrderCompleted: {
    IN_APP: { title: "Order completed", message: "An order has been completed and the customer has received their delivery." },
    WHATSAPP: { title: "Order completed", message: "Order {{orderNumber}} has been completed. Ask the customer for feedback." },
    EMAIL: { title: "Order completed", message: "Your order {{orderNumber}} has been completed. We hope you loved it!" },
    SMS: { title: "Order completed", message: "Your order {{orderNumber}} is complete. Thank you!" },
  },
  QuotationAccepted: {
    IN_APP: { title: "Quotation accepted", message: "A quotation has been accepted and the order is ready for confirmation." },
    WHATSAPP: { title: "Quotation accepted", message: "Quotation {{quotationNumber}} has been accepted." },
    EMAIL: { title: "Quotation accepted", message: "Your quotation {{quotationNumber}} has been accepted. Please confirm to proceed." },
    SMS: { title: "Quotation accepted", message: "Your quotation has been accepted." },
  },
  InquiryCreated: {
    IN_APP: { title: "New inquiry", message: "A new customer inquiry requires attention from the Customer Support team." },
    WHATSAPP: { title: "New inquiry", message: "New customer inquiry received. Please respond." },
    EMAIL: { title: "New inquiry", message: "A new customer inquiry has been received." },
    SMS: { title: "New inquiry", message: "New inquiry received." },
  },
  InquiryResolved: {
    IN_APP: { title: "Inquiry resolved", message: "A customer inquiry has been resolved." },
    WHATSAPP: { title: "Inquiry resolved", message: "The inquiry has been resolved." },
    EMAIL: { title: "Inquiry resolved", message: "Your inquiry has been resolved." },
    SMS: { title: "Inquiry resolved", message: "Inquiry resolved." },
  },
  CustomerComplaint: {
    IN_APP: { title: "Customer complaint", message: "A customer complaint has been logged and requires escalation." },
    WHATSAPP: { title: "Customer complaint", message: "A complaint has been logged. Please handle promptly." },
    EMAIL: { title: "Customer complaint", message: "A complaint has been logged and requires attention." },
    SMS: { title: "Customer complaint", message: "A complaint has been logged." },
  },
  FeedbackRecorded: {
    IN_APP: { title: "New feedback", message: "A customer has submitted feedback on an order." },
    WHATSAPP: { title: "New feedback", message: "New customer feedback received." },
    EMAIL: { title: "New feedback", message: "A customer has shared feedback." },
    SMS: { title: "New feedback", message: "New feedback received." },
  },
  PaymentReceived: {
    IN_APP: { title: "Payment received", message: "A payment has been received against an order." },
    WHATSAPP: { title: "Payment received", message: "Payment received for order {{orderNumber}}." },
    EMAIL: { title: "Payment received", message: "Payment received for order {{orderNumber}}." },
    SMS: { title: "Payment received", message: "Payment received for your order." },
  },
  StockShortageDetected: {
    IN_APP: { title: "Stock shortage", message: "Required stock is unavailable for a production job. Create a purchase requirement." },
    WHATSAPP: { title: "Stock shortage", message: "Stock shortage detected for production." },
    EMAIL: { title: "Stock shortage", message: "Stock shortage detected. Review inventory." },
    SMS: { title: "Stock shortage", message: "Stock shortage detected." },
  },
  LowStockAlert: {
    IN_APP: { title: "Low stock alert", message: "An ingredient has fallen to or below its reorder level. Review stock and raise a purchase requirement." },
    WHATSAPP: { title: "Low stock alert", message: "An ingredient is running low. Consider reordering soon." },
    EMAIL: { title: "Low stock alert", message: "An ingredient has fallen to or below its reorder level. Review inventory and raise a purchase requirement." },
    SMS: { title: "Low stock alert", message: "Stock alert: an ingredient is below its reorder level." },
  },
  ProductionStarted: {
    IN_APP: { title: "Production started", message: "A production job has started." },
    WHATSAPP: { title: "Production started", message: "Production has started for order {{orderNumber}}." },
    EMAIL: { title: "Production started", message: "Production has started for your order." },
    SMS: { title: "Production started", message: "Production started." },
  },
  ProductionCompleted: {
    IN_APP: { title: "Production completed", message: "A production job is complete and ready for quality check." },
    WHATSAPP: { title: "Production completed", message: "Production completed for order {{orderNumber}}." },
    EMAIL: { title: "Production completed", message: "Your order has been produced and is ready for quality check." },
    SMS: { title: "Production completed", message: "Production complete." },
  },
  GoodsReceived: {
    IN_APP: { title: "Goods received", message: "Stock has been received against a purchase order." },
    WHATSAPP: { title: "Goods received", message: "Goods received and stock updated." },
    EMAIL: { title: "Goods received", message: "Goods received. Inventory updated." },
    SMS: { title: "Goods received", message: "Goods received." },
  },
  PurchaseRequirementCreated: {
    IN_APP: { title: "Purchase requirement", message: "A purchase requirement has been created for stock replenishment." },
    WHATSAPP: { title: "Purchase requirement", message: "New purchase requirement created." },
    EMAIL: { title: "Purchase requirement", message: "A purchase requirement has been created." },
    SMS: { title: "Purchase requirement", message: "New requirement created." },
  },
  QualityFailed: {
    IN_APP: { title: "Quality check failed", message: "A quality check failed and rework is required." },
    WHATSAPP: { title: "Quality failed", message: "Quality check failed for order {{orderNumber}}. Rework needed." },
    EMAIL: { title: "Quality check failed", message: "Quality check failed. Rework required." },
    SMS: { title: "Quality failed", message: "Quality check failed." },
  },
  QualityPassed: {
    IN_APP: { title: "Quality check passed", message: "Quality check passed and the order is ready for delivery." },
    WHATSAPP: { title: "Quality passed", message: "Quality check passed for order {{orderNumber}}." },
    EMAIL: { title: "Quality passed", message: "Quality check passed. Ready for delivery." },
    SMS: { title: "Quality passed", message: "Quality passed." },
  },
  DeliveryDue: {
    IN_APP: { title: "Delivery due", message: "A delivery is due today." },
    WHATSAPP: { title: "Delivery due", message: "Delivery due for order {{orderNumber}}." },
    EMAIL: { title: "Delivery due", message: "A delivery is due today." },
    SMS: { title: "Delivery due", message: "Delivery due today." },
  },
  DeliveryDispatched: {
    IN_APP: { title: "Delivery dispatched", message: "Order {{orderNumber}} has been dispatched to the customer." },
    WHATSAPP: { title: "Delivery dispatched", message: "Your order {{orderNumber}} is on its way." },
    EMAIL: { title: "Delivery dispatched", message: "Your order {{orderNumber}} has been dispatched. Tracking details will follow." },
    SMS: { title: "Delivery dispatched", message: "Your order {{orderNumber}} has been dispatched." },
  },
  DeliveryCompleted: {
    IN_APP: { title: "Delivery completed", message: "Order {{orderNumber}} has been delivered. Please leave feedback." },
    WHATSAPP: { title: "Delivery completed", message: "Your order {{orderNumber}} has been delivered." },
    EMAIL: { title: "Delivery completed", message: "Your order {{orderNumber}} has been delivered. We hope you enjoyed it!" },
    SMS: { title: "Delivery completed", message: "Your order {{orderNumber}} is delivered. Thanks!" },
  },
  ExpenseCreated: {
    IN_APP: { title: "Expense recorded", message: "A new expense has been recorded ({{amount}}). Review it in Finance." },
    WHATSAPP: { title: "Expense recorded", message: "New expense recorded: {{amount}}." },
    EMAIL: { title: "Expense recorded", message: "A new expense of {{amount}} was recorded." },
    SMS: { title: "Expense recorded", message: "Expense recorded: {{amount}}." },
  },
  ExpenseApproved: {
    IN_APP: { title: "Expense approved", message: "Expense {{expenseId}} was approved for payment." },
    WHATSAPP: { title: "Expense approved", message: "Expense {{expenseId}} approved." },
    EMAIL: { title: "Expense approved", message: "Expense {{expenseId}} was approved." },
    SMS: { title: "Expense approved", message: "Expense {{expenseId}} approved." },
  },
  OrderCancelled: {
    IN_APP: { title: "Order cancelled", message: "An order has been cancelled." },
    WHATSAPP: { title: "Order cancelled", message: "Order {{orderNumber}} has been cancelled." },
    EMAIL: { title: "Order cancelled", message: "Your order has been cancelled." },
    SMS: { title: "Order cancelled", message: "Order cancelled." },
  },
  OrderRejected: {
    IN_APP: { title: "Order rejected", message: "An order has been rejected and will not proceed." },
    WHATSAPP: { title: "Order rejected", message: "Order {{orderNumber}} rejected." },
    EMAIL: { title: "Order rejected", message: "Your order has been rejected." },
    SMS: { title: "Order rejected", message: "Order rejected." },
  },
  SettingsUpdated: {
    IN_APP: { title: "Settings updated", message: "Business settings have been updated." },
    WHATSAPP: { title: "Settings updated", message: "Settings have been updated." },
    EMAIL: { title: "Settings updated", message: "Business settings have been updated." },
    SMS: { title: "Settings updated", message: "Settings updated." },
  },
  CatalogueCreated: {
    IN_APP: { title: "Catalogue updated", message: "A catalogue update has been made." },
    WHATSAPP: { title: "Catalogue updated", message: "Catalogue updated." },
    EMAIL: { title: "Catalogue updated", message: "The catalogue has been updated. Please review." },
    SMS: { title: "Catalogue updated", message: "Catalogue updated." },
  },
  CatalogueUpdated: {
    IN_APP: { title: "Catalogue updated", message: "A catalogue update has been made." },
    WHATSAPP: { title: "Catalogue updated", message: "Catalogue updated." },
    EMAIL: { title: "Catalogue updated", message: "The catalogue has been updated. Please review." },
    SMS: { title: "Catalogue updated", message: "Catalogue updated." },
  },
  CatalogueArchived: {
    IN_APP: { title: "Catalogue archived", message: "A catalogue item has been archived." },
    WHATSAPP: { title: "Catalogue archived", message: "Catalogue item archived." },
    EMAIL: { title: "Catalogue archived", message: "A catalogue item has been archived." },
    SMS: { title: "Catalogue archived", message: "Catalogue archived." },
  },
  JobCompleted: {
    IN_APP: { title: "Job archived", message: "A production job has been archived to history." },
    WHATSAPP: { title: "Job archived", message: "Production job archived." },
    EMAIL: { title: "Job archived", message: "A production job has been archived to history." },
    SMS: { title: "Job archived", message: "Job archived." },
  },
};

const ROLES_FOR_EVENT: Record<NotificationEventType, string[]> = {
  OrderConfirmed: ["Admin / Proprietor", "Production Manager", "Sales Manager", "Customer Service Representative"],
  OrderCompleted: ["Admin / Proprietor", "Sales Manager"],
  QuotationAccepted: ["Admin / Proprietor", "Sales Manager"],
  InquiryCreated: ["Admin / Proprietor", "Customer Service Representative"],
  InquiryResolved: ["Customer Service Representative"],
  CustomerComplaint: ["Admin / Proprietor", "Customer Service Representative"],
  FeedbackRecorded: ["Admin / Proprietor", "Production Manager", "Sales Manager"],
  PaymentReceived: ["Admin / Proprietor", "Finance"],
  StockShortageDetected: ["Admin / Proprietor", "Production Manager", "Sales Manager"],
  LowStockAlert: ["Admin / Proprietor", "Production Manager"],
  ProductionStarted: ["Production Manager", "Admin / Proprietor", "Sales Manager"],
  ProductionCompleted: ["Production Manager", "Admin / Proprietor"],
  GoodsReceived: ["Production Manager", "Admin / Proprietor", "Finance"],
  PurchaseRequirementCreated: ["Production Manager", "Admin / Proprietor", "Customer Service Representative"],
  QualityFailed: ["Production Manager", "Admin / Proprietor"],
  QualityPassed: ["Production Manager"],
  DeliveryDue: ["Production Manager", "Customer Service Representative"],
  DeliveryDispatched: ["Production Manager", "Admin / Proprietor"],
  DeliveryCompleted: ["Production Manager", "Admin / Proprietor"],
  ExpenseCreated: ["Admin / Proprietor", "Finance"],
  ExpenseApproved: ["Admin / Proprietor", "Finance"],
  OrderCancelled: ["Admin / Proprietor"],
  OrderRejected: ["Admin / Proprietor"],
  SettingsUpdated: ["Admin / Proprietor"],
  CatalogueCreated: ["Admin / Proprietor"],
  CatalogueUpdated: ["Admin / Proprietor"],
  CatalogueArchived: ["Admin / Proprietor"],
  JobCompleted: ["Production Manager", "Admin / Proprietor"],
};

function resolveRecipients(session: { userId: string; role: string; isAdmin: boolean }, event: NotificationEvent): User[] {
  const users = store.users();
  if (session.isAdmin) {
    return users.filter((u) => u.status === "Active");
  }
  const roles = ROLES_FOR_EVENT[event.eventTypeId] || ["Admin / Proprietor"];
  return users.filter((u) => roles.includes(u.role) && u.status === "Active");
}

const CHANNEL_ORDER: NotificationChannel_[] = ["IN_APP", "WHATSAPP", "EMAIL", "SMS"];

export class NotificationService {
  private templates: NotificationTemplate[] = [];

  constructor() {
    Object.entries(TEMPLATES).forEach(([eventTypeId, channels]) => {
      Object.entries(channels).forEach(([channel, { title, message }]) => {
        const template: NotificationTemplate = {
          id: `${eventTypeId}-${channel}`,
          eventTypeId,
          channel: channel as NotificationChannel_,
          titleTemplate: title,
          messageTemplate: message,
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.templates.push(template);
        store.createNotificationTemplate(template as unknown as Patch);
      });
    });
  }

  private findTemplate(eventTypeId: NotificationEventType, channel: NotificationChannel_): NotificationTemplate | undefined {
    return this.templates.find((t) => t.eventTypeId === eventTypeId && t.channel === channel && t.active);
  }

  private notifyUser(user: User, event: NotificationEvent, channel: NotificationChannel_): NotificationRecipient {
    const template = this.findTemplate(event.eventTypeId, channel);
    if (!template) return { id: "", notificationId: "", userId: user.id, deliveryChannel: channel, deliveredAt: null, readAt: null, failedAt: null, failureReason: null, createdAt: "", updatedAt: "" };
    const title = template.titleTemplate;
    const message = template.messageTemplate;
    const notification: Notification = store.createNotification({
      eventTypeId: event.eventTypeId,
      title,
      message,
      priority: event.priority,
      entityType: event.entityType,
      entityId: event.entityId,
      actionUrl: event.actionUrl,
      deepLink: event.deepLink,
      createdBy: event.createdBy,
    });
    const recipient: NotificationRecipient = {
      id: `nrec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      notificationId: notification.id,
      userId: user.id,
      deliveryChannel: channel,
      deliveredAt: null,
      readAt: null,
      failedAt: null,
      failureReason: null,
      createdAt: notification.createdAt,
      updatedAt: notification.createdAt,
    };
    store.createNotificationRecipient(recipient as unknown as Patch);
    return recipient;
  }

  publishEvent(event: NotificationEvent, session: { userId: string; role: string; isAdmin: boolean }): Notification[] {
    const recipients = resolveRecipients(session, event);
    const delivered: Notification[] = [];
    for (const user of recipients) {
      for (const channel of CHANNEL_ORDER) {
        this.notifyUser(user, event, channel);
      }
    }
    return delivered;
  }

  getUserNotifications(userId: string, limit = 50): Notification[] {
    const all = store.notifications();
    return all
      .filter((n) => n.createdBy !== userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  getUnreadCount(userId: string): number {
    return store.notificationRecipients().filter((r) => r.userId === userId && !r.readAt).length;
  }

  markAsRead(notificationId: string, userId: string): boolean {
    const recipients = store.notificationRecipients();
    const rec = recipients.find((r) => r.id === notificationId && r.userId === userId);
    if (!rec) return false;
    rec.readAt = new Date().toISOString();
    store.persist();
    return true;
  }

  markAllAsRead(userId: string): number {
    let count = 0;
    const recipients = store.notificationRecipients();
    for (const rec of recipients) {
      if (rec.userId === userId && !rec.readAt) {
        rec.readAt = new Date().toISOString();
        count += 1;
      }
    }
    store.persist();
    return count;
  }

  getNotificationPreferences(userId: string): NotificationPreference[] {
    return store.getNotificationPreferences(userId);
  }

  getPreferencesForEvent(userId: string, eventTypeId: NotificationEventType): Record<NotificationChannel_, boolean> {
    const prefs = this.getNotificationPreferences(userId);
    const channels = CHANNEL_ORDER.reduce<Record<NotificationChannel_, boolean>>((acc, ch) => {
      acc[ch] = false;
      return acc;
    }, {} as Record<NotificationChannel_, boolean>);
    const enabled = prefs.filter((p) => p.userId === userId && p.eventTypeId === eventTypeId && p.enabled);
    for (const ch of CHANNEL_ORDER) {
      const match = enabled.find((p) => p.channel === ch);
      if (match) channels[ch] = true;
    }
    return channels;
  }

  listTemplates(): NotificationTemplate[] {
    return this.templates;
  }
}

export const notificationService = new NotificationService();
