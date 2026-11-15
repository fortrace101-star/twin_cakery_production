import type { Response } from "express";

const clients = new Map<string, Set<Response>>();

export function addNotificationClient(userId: string, res: Response): void {
  const set = clients.get(userId) || new Set<Response>();
  set.add(res);
  clients.set(userId, set);
}

export function removeNotificationClient(userId: string, res: Response): void {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clients.delete(userId);
}

export function emitNotificationEvent(userId: string, event: string, data: unknown): void {
  const set = clients.get(userId);
  if (!set || set.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of Array.from(set)) {
    try {
      res.write(payload);
    } catch {
      set.delete(res);
    }
  }
  if (set.size === 0) clients.delete(userId);
}
