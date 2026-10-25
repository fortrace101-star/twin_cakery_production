import { Router, RequestHandler } from "express";
import { store } from "../database/store.js";
import { rbacService } from "../services/rbac.service.js";
import { AuthService, extractToken } from "../services/auth.service.js";

const router = Router();
const authService = new AuthService();

const required = (perm: string): RequestHandler => async (req, res, next) => {
  try {
    const session = authService.requireAuth(extractToken(req.headers.authorization as string | undefined));
    await rbacService.requirePermission(session.userId, perm);
    next();
  } catch (err) {
    if (err instanceof Error && err.name === "UnauthorizedError") return res.status(401).json({ error: err.message });
    if (err instanceof Error && err.name === "ForbiddenError") return res.status(403).json({ error: err.message });
    next(err);
  }
};

router.get("/", required("inquiries.view"), (req, res) => {
  const inquiries = store.inquiries();
  const status = req.query.status as string | undefined;
  const channel = req.query.channel as string | undefined;
  let list = inquiries;
  if (status) list = list.filter((i) => i.status === status);
  if (channel) list = list.filter((i) => i.channel === channel);
  res.json(list);
});

router.post("/", required("inquiries.create"), (req, res) => {
  const { customerId, channel, staffMember, subject, summary, details, status, priority, followUpRequired, source } = req.body || {};
  if (!subject || !channel) return res.status(400).json({ error: "subject and channel are required" });
  const record = store.createInquiry({
    customerId: customerId || "",
    channel: channel as import("../database/types.js").Channel,
    staffMember: staffMember || null,
    subject,
    summary: summary || "",
    details: details || "",
    status: status || "NEW",
    priority: priority || "MEDIUM",
    followUpRequired: followUpRequired || false,
    source: source || "PHONE",
  });
  res.status(201).json(record);
});

router.get("/:id", required("inquiries.view"), (req, res) => {
  const inquiry = store.inquiries().find((i) => i.id === String(req.params.id));
  if (!inquiry) throw new Error("Inquiry not found");
  res.json(inquiry);
});

router.patch("/:id", required("inquiries.edit"), (req, res) => {
  const id = String(req.params.id);
  const inquiry = store.inquiries().find((i) => i.id === id);
  if (!inquiry) throw new Error("Inquiry not found");
  const patch = req.body || {};
  const updated = { ...inquiry, ...patch, updatedAt: new Date().toISOString() };
  store.persist();
  res.json(updated);
});

export default router;
