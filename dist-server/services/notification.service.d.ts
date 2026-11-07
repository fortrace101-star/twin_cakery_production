import type { Notification, NotificationPreference, NotificationTemplate, NotificationPriority } from "../database/types.js";
export type EventSource = "order" | "quotation" | "inquiry" | "customer" | "production" | "inventory" | "purchasing" | "delivery" | "payment" | "feedback" | "expense" | "catalogue" | "settings";
export type NotificationEventType = "OrderConfirmed" | "OrderCompleted" | "QuotationAccepted" | "InquiryCreated" | "InquiryResolved" | "CustomerComplaint" | "FeedbackRecorded" | "PaymentReceived" | "StockShortageDetected" | "LowStockAlert" | "ProductionStarted" | "ProductionCompleted" | "GoodsReceived" | "PurchaseRequirementCreated" | "QualityFailed" | "QualityPassed" | "DeliveryDue" | "DeliveryDispatched" | "DeliveryCompleted" | "ExpenseCreated" | "ExpenseApproved" | "OrderCancelled" | "OrderRejected" | "SettingsUpdated" | "CatalogueCreated" | "CatalogueUpdated" | "CatalogueArchived" | "JobCompleted";
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
export declare class NotificationService {
    private templates;
    constructor();
    private findTemplate;
    private notifyUser;
    publishEvent(event: NotificationEvent, session: {
        userId: string;
        role: string;
        isAdmin: boolean;
    }): Notification[];
    getUserNotifications(userId: string, limit?: number): Notification[];
    getUnreadCount(userId: string): number;
    markAsRead(notificationId: string, userId: string): boolean;
    markAllAsRead(userId: string): number;
    getNotificationPreferences(userId: string): NotificationPreference[];
    getPreferencesForEvent(userId: string, eventTypeId: NotificationEventType): Record<NotificationChannel_, boolean>;
    listTemplates(): NotificationTemplate[];
}
export declare const notificationService: NotificationService;
