    return record;
  }

  createNotificationTemplate(template: Partial<Record<string, unknown>>): NotificationTemplate {
    const now = new Date().toISOString();
    const record: NotificationTemplate = {
      id: `ntp-${now}-${Math.random().toString(36).slice(2, 8)}`,
      eventTypeId: String(template.eventTypeId ?? "")
      channel: String(template.channel ?? "EMAIL")
      titleTemplate: String(template.titleTemplate ?? "")
      messageTemplate: String(template.messageTemplate ?? "")
      active: mapBool(template.active),
      createdAt: now,
      updatedAt: now,
    };
    this.db.notificationTemplates.push(record);
    this.db.persist();
    return record;
  }
    return record;
  }

  createNotificationTemplate(template: Partial<Record<string, unknown>>): NotificationTemplate {
    const now = new Date().toISOString();
    const .db.customerFeedback.push(record);$
    this.db.persist();$
    return record;$
  }$
      id: `ntp-${now}-${Math.random().toString(36).slice(2, 8)}`,
      eventTypeId: String(template.eventTypeId ?? ""),
      channel: String(template.channel ?? "EMAIL"),
      titleTemplate: String(template.titleTemplate ?? ""),
      messageTemplate: String(template.messageTemplate ?? ""),
      active: mapBool(template.active),
      createdAt: now,
      updatedAt: now,

  createNotificationTemplate(template: Partial<Record<string, unknown>>): NotificationTemplate {
    const now = new Date().toISOString();
    const record: NotificationTemplate = {
      id: `ntp-${now}-${Math.random().toString(36).slice(2, 8)}`,
      eventTypeId: String(template.eventTypeId ?? ""),
      channel: String(template.channel ?? "EMAIL"),
      titleTemplate: String(template.titleTemplate ?? ""),
      messageTemplate: String(template.messageTemplate ?? ""),
      active: mapBool(template.active),
      createdAt: now,
      updatedAt: now,
    };
    this.db.notificationTemplates.push(record);
    this.db.persist();
    return record;
  }
}
