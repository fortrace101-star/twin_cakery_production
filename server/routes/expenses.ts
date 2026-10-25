import { Router, RequestHandler } from "express";
import { store } from "../database/store.js";
import { rbacService } from "../services/rbac.service.js";
import { AuthService, extractToken } from "../services/auth.service.js";
import { NotFoundError, ConflictError } from "../utils/errors.js";
import { makeId } from "../utils/make-id.js";
import { paginate } from "../utils/paginate.js";

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

const number = (v: unknown): number => typeof v === "number" && Number.isFinite(Number(v)) ? Number(v) : NaN;

// ── Expenses (E4) ──────────────────────────────────────────────────────────
// Mounted at /expenses (api.ts), so paths here are relative: GET /expenses
// lists, GET /expenses/:id fetches one. Category reads/writes live in
// expenseCategoryRouter below, mounted at /expense-categories.

router.get("/", required("finance.view"), (req, res) => {
  const expenses = store.db.expenses as import("../database/types.js").Expense[];
  const category = req.query.category as string | undefined;
  let list = expenses;
  if (category) list = list.filter((e) => e.categoryId === category);
  // §33 — opt-in pagination envelope (plain array without ?page=).
  res.json(paginate(list, req.query, {
    sortable: ["date", "amount", "createdAt"],
    dateField: "date",
    searchFields: ["description", "reference"],
  }));
});

router.post("/", required("finance.record_expense"), (req, res) => {
  const { categoryId, amount, date, paymentMethod, reference, description, attachment, recordedBy } = req.body || {};
  if (!categoryId || !number(amount)) return res.status(400).json({ error: "categoryId and amount are required" });
  const expense = store.createExpense({
    categoryId: String(categoryId),
    amount: number(amount),
    date: date || new Date().toISOString(),
    paymentMethod: paymentMethod || "Cash",
    reference: reference || "",
    description: description || "",
    attachment: attachment || null,
    recordedBy: recordedBy || "admin",
  });
  store.createAuditLog({
    actor: String(expense.recordedBy || "admin"), action: "expense:created",
    entityType: "expense", entityId: expense.id,
    reason: `${expense.paymentMethod} · ${expense.description || expense.reference || "expense"}`,
  });
  store.persist();
  res.status(201).json(expense);
});

router.get("/:id", required("finance.view"), (req, res) => {
  const expense = store.db.expenses.find((e) => e.id === String(req.params.id));
  if (!expense) throw new NotFoundError("Expense not found");
  res.json(expense);
});

router.patch("/:id", required("finance.record_expense"), (req, res) => {
  const id = String(req.params.id);
  const expense = store.db.expenses.find((e) => e.id === id);
  if (!expense) throw new NotFoundError("Expense not found");
  const { amount, date, paymentMethod, reference, description, attachment, recordedBy } = req.body || {};
  if (amount !== undefined) expense.amount = number(amount);
  if (date !== undefined) expense.date = date;
  if (paymentMethod !== undefined) expense.paymentMethod = paymentMethod;
  if (reference !== undefined) expense.reference = reference;
  if (description !== undefined) expense.description = description;
  if (attachment !== undefined) expense.attachment = attachment;
  if (recordedBy !== undefined) expense.recordedBy = recordedBy;
  expense.updatedAt = new Date().toISOString();
  store.createAuditLog({
    actor: String(expense.recordedBy || "admin"), action: "expense:updated",
    entityType: "expense", entityId: expense.id,
    reason: expense.description || expense.reference || "Expense edited",
  });
  store.persist();
  res.json(expense);
});

router.delete("/:id", required("finance.record_expense"), (req, res) => {
  const id = String(req.params.id);
  const before = store.db.expenses.findIndex((e) => e.id === id);
  if (before === -1) throw new NotFoundError("Expense not found");
  store.db.expenses.splice(before, 1);
  store.persist();
  res.json({ ok: true });
});

// ── Expense categories (E4) ────────────────────────────────────────────────
// Separate router mounted at /expense-categories (api.ts), because the
// frontend calls GET /expense-categories directly.

export const expenseCategoryRouter = Router();

expenseCategoryRouter.get("/", required("finance.view"), (req, res) => {
  const categories = store.db.expenseCategories as import("../database/types.js").ExpenseCategory[];
  const name = req.query.name as string | undefined;
  let list = categories;
  if (name) list = list.filter((c) => c.name.toLowerCase().includes(String(name).toLowerCase()));
  res.json(list);
});

expenseCategoryRouter.post("/", required("finance.record_expense"), (req, res) => {
  const { name } = req.body || {};
  const trimmed = String(name || "").trim();
  if (!trimmed) return res.status(400).json({ error: "name is required" });
  if (store.db.expenseCategories.some((c) => c.name === trimmed)) throw new ConflictError("Category already exists");
  const category = { id: makeId("cat"), name: trimmed, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  store.db.expenseCategories.push(category);
  store.persist();
  res.status(201).json(category);
});

export default router;
