/**
 * ERP "Site Management" content router (E2).
 *
 * Backs the ERP page that authors the public website's content — blog posts +
 * categories and website user accounts. Everything written here flows straight
 * to Postgres; the public website reads the published subset via
 * GET /api/v1/public/* (see routes/public.ts). One backend, one database.
 *
 * Writes are RBAC-guarded (content.* permissions, granted to Admin).
 */
declare const router: import("express-serve-static-core").Router;
export default router;
