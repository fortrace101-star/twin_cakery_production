/**
 * One-time/idempotent migration: server/data/store.json -> Postgres.
 * Run: cd server && node --import tsx scripts/migrate-store-json-to-pg.ts
 * - Inserts in FK-safe order (best-effort for known deps).
 * - Uses ON CONFLICT (id) DO NOTHING / DO UPDATE where safe.
 * - Creates a minimal placeholder customer for orphan order.customerId FKs.
 * - Does NOT delete Postgres rows (non-destructive upsert migration).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../database/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE = path.resolve(__dirname, "..", "data", "store.json");

type Row = Record<string, any>;
const read = (): any => JSON.parse(fs.readFileSync(STORE, "utf8"));

function cols(table: string, row: Row, allowed: string[], map: Record<string,string> = {}) {
  const entries: [string, any][] = [];
  for (const c of allowed) {
    const k = map[c] || c.replace(/_([a-z])/g, (_,l)=>l.toUpperCase());
    if (row[k] !== undefined) entries.push([c, row[k]]);
    else if (c === "tx_user" && row.user !== undefined) entries.push([c, row.user]);
  }
  if (!entries.find(e=>e[0]==="id") && row.id) entries.unshift(["id", row.id]);
  return entries;
}
async function upsert(table: string, rows: Row[], allowed: string[], conflict="id", map: Record<string,string> = {}) {
  let ok=0, skip=0;
  for (const row of rows || []) {
    if (!row?.id) { skip++; continue; }
    const e = cols(table, row, allowed, map).filter(([,v])=>v!==undefined);
    if (!e.length) { skip++; continue; }
    const ks=e.map(x=>x[0]), vs=e.map(x=>x[1]);
    const ph=ks.map((_,i)=>`$${i+1}`).join(",");
    const set=ks.filter(k=>k!==conflict).map(k=>`${k}=EXCLUDED.${k}`).join(",");
    const sql=`INSERT INTO ${table} (${ks.join(",")}) VALUES (${ph}) ON CONFLICT (${conflict}) DO ${set?`UPDATE SET ${set}`:"NOTHING"}`;
    try { await pool.query(sql, vs); ok++; } catch (err:any) { skip++; console.warn(`[skip] ${table} ${row.id}: ${err.message.split("\n")[0]}`); }
  }
  console.log(`${table}: ${ok} upserted, ${skip} skipped`);
}

async function main() {
  if (!fs.existsSync(STORE)) throw new Error(`Missing ${STORE}`);
  const d = read();
  const now = new Date().toISOString();
  // Ensure orphan order customers exist (FK orders.customer_id -> customers)
  const custIds = new Set((d.customers||[]).map((c:any)=>c.id));
  const orphans = [...new Set((d.orders||[]).map((o:any)=>o.customerId).filter(Boolean))].filter(id=>!custIds.has(id));
  for (const id of orphans) {
    await pool.query(`INSERT INTO customers (id,name,created_at,updated_at,status) VALUES ($1,$2,$3,$3,'Active') ON CONFLICT (id) DO NOTHING`,
      [id, `Migrated Customer ${id}`, now]);
    console.log(`created placeholder customer ${id}`);
  }

  // FK-safe order (subset of critical tables; extend as needed)
  await upsert("customers", d.customers, ["id","name","phone","email","preferred_contact_method","source","notes","status","created_at","updated_at","feedback_summary"]);
  await upsert("customer_addresses", (d.customers||[]).flatMap((c:any)=>c.addresses||[]), ["id","customer_id","label","line1","line2","city","county","postal_code","country","is_default","created_at","updated_at"]);
  await upsert("users", d.users, ["id","username","display_name","email","phone","role","is_admin","status","password_hash","created_at","updated_at"]);
  await upsert("roles", d.roles, ["id","name","description","active","created_at","updated_at"]);
  await upsert("permissions", d.permissions, ["id","key","label","description","group_name","active","created_at","updated_at"]);
  await upsert("user_roles", d.userRoles, ["id","user_id","role_id","created_at","updated_at"]);
  await upsert("role_permissions", d.rolePermissions, ["id","role_id","permission_id","created_at","updated_at"]);
  await upsert("inventory_items", d.inventoryItems, ["id","name","sku","category","unit","reorder_level","supplier_id","last_updated","created_at","updated_at","cost"]);
  await upsert("suppliers", d.suppliers, ["id","name","contact_person","phone","email","address","lead_time_days","payment_terms","status","created_at","updated_at"]);
  await upsert("orders", d.orders, ["id","order_number","customer_id","salesperson_id","subtotal","discount","delivery_charge","tax_amount","total","required_by","required_at","status","payment_status","delivery_status","notes","source","created_at","updated_at","quotation_id","inquiry_id","delivery_location","location_note","follow_up_completed_at","currency"]);
  await upsert("order_items", d.orderItems, ["id","order_id","product_id","product_name","variant_options","quantity","unit_price","total","created_at","updated_at"]);
  await upsert("order_status_history", d.orderStatusHistory, ["id","order_id","previous_status","new_status","changed_by","changed_at","reason"]);
  await upsert("order_customer_snapshots", d.orderSnapshots, ["id","order_id","customer_id","snapshot_name","snapshot_phone","snapshot_email","snapshot_address","created_at"]);
  await upsert("payments", d.payments, ["id","order_id","amount","method","reference","status","recorded_by","recorded_at","created_at","updated_at","kind","reverses_payment_id","provider","provider_ref","reconciled_at","reconciliation_ref","raw_callback"]);
  await upsert("inquiries", d.inquiries, ["id","customer_id","channel","staff_member","subject","summary","details","status","priority","related_quote_id","related_order_id","follow_up_required","next_action","resolved_at","source","created_at","updated_at"]);
  await upsert("quotations", d.quotations, ["id","quotation_number","customer_id","status","subtotal","discount","tax_amount","total","valid_until","notes","created_by","approved_by","created_at","updated_at"]);
  await upsert("quotation_items", d.quotationItems, ["id","quotation_id","product_id","product_name","variant_options","quantity","unit_price","total","created_at","updated_at"]);
  await upsert("production_jobs", d.productionJobs, ["id","order_id","customer_id","product_id","variant_options","quantity","recipe_version","required_by","required_at","status","stage","progress","notes","created_at","updated_at"]);
  await upsert("deliveries", d.deliveries, ["id","order_id","type","destination","scheduled_at","scheduled_date","scheduled_time","actual_dispatch_time","delivery_person","delivery_fee","status","notes","customer_confirmation","created_at","updated_at","actual_delivery_date"]);
  await upsert("inventory_transactions", d.inventoryTransactions, ["id","item_id","quantity","unit","type","reference","tx_user","timestamp","unit_cost","notes","created_at","updated_at"]);
  await upsert("stock_reservations", d.stockReservations, ["id","item_id","quantity","unit","order_id","reference","reserved_at","created_at","updated_at"]);
  await upsert("notifications", d.notifications, ["id","channel","title","body","order_id","delivery_id","status","created_at","updated_at","created_by"]);
  await upsert("audit_logs", d.auditLogs, ["id","actor","action","entity_type","entity_id","order_id","previous_status","new_status","reason","amount","payment_method","reference","created_at"]);
  await upsert("order_proposals", d.orderProposals, ["id","proposal_number","customer_name","phone","email","product_summary","quantity","preferred_date","preferred_time","delivery_type","delivery_location","customer_notes","reference_image","status","created_at","updated_at","customer_id","converted_order_id","reviewed_by","reviewed_at"]);
  await upsert("order_proposal_items", d.orderProposalItems, ["id","proposal_id","product_id","product_name","variant_options","quantity","unit_price","total","created_at","updated_at"]);

  // ---- extended coverage (best-effort, idempotent) ----
  await upsert("role_permissions", d.rolePermissions, ["id","role_id","permission_id","created_at","updated_at"]);
  await upsert("customer_interactions", d.customerInteractions, ["id","customer_id","type","channel","subject","summary","outcome","follow_up_required","next_action","created_by","created_at","updated_at"]);
  await upsert("customer_feedback", d.customerFeedback, ["id","customer_id","order_id","rating","comment","source","created_at","updated_at"]);
  await upsert("customer_events", d.customerEvents, ["id","customer_id","type","title","event_date","notes","created_at","updated_at"]);
  await upsert("customer_event_reminders", d.customerEventReminders, ["id","event_id","customer_id","remind_at","channel","status","sent_at","created_at","updated_at"]);
  await upsert("notification_recipients", d.notificationRecipients, ["id","notification_id","user_id","delivery_channel","delivered_at","read_at","failed_at","failure_reason","created_at","updated_at"]);
  await upsert("notification_preferences", d.notificationPreferences, ["id","user_id","event_type_id","channel","enabled","created_at","updated_at"]);
  await upsert("notification_templates", d.notificationTemplates, ["id","event_type_id","channel","title_template","message_template","active","created_at","updated_at"]);
  await upsert("staff", d.staff, ["id","staff_number","name","phone","email","job_title","employment_status","start_date","schedule","notes","user_id","created_at","updated_at"]);
  await upsert("staff_attendance", d.staffAttendance, ["id","staff_id","date","status","hours","notes","recorded_by","created_at","updated_at"]);
  await upsert("salary_profiles", d.salaryProfiles, ["id","staff_id","basic_salary","payment_frequency","allowance_amount","deduction_amount","effective_from","notes","created_at","updated_at"]);
  await upsert("staff_advances", d.staffAdvances, ["id","staff_id","amount","repaid_amount","reason","advance_date","status","repayment_log","recorded_by","created_at","updated_at"]);
  await upsert("remuneration_periods", d.remunerationPeriods, ["id","label","period_type","start_date","end_date","intended_payment_date","status","total_amount","paid_amount","notes","created_by","approved_by","created_at","updated_at"]);
  await upsert("remuneration_items", d.remunerationItems, ["id","period_id","staff_id","basic_salary","allowances","bonuses","deductions","advance_amount","other_payments","net_amount","paid_amount","status","created_at","updated_at"]);
  await upsert("remuneration_payments", d.remunerationPayments, ["id","period_id","staff_id","item_id","amount","payment_date","method","reference","payment_status","notes","recorded_by","created_at","updated_at"]);
  await upsert("payslips", d.payslips, ["id","period_id","staff_id","item_id","period_label","staff_name","basic_salary","allowances","bonuses","deductions","advance_amount","other_payments","net_amount","paid_amount","status","issued_at","created_at","updated_at"]);
  await upsert("expense_categories", d.expenseCategories, ["id","name","created_at","updated_at"]);
  await upsert("expenses", d.expenses, ["id","category_id","amount","date","payment_method","reference","description","attachment","recorded_by","created_at","updated_at"]);
  await upsert("purchase_requirements", d.purchaseRequirements, ["id","product_ids","quantity","unit","reason","urgency","status","requested_by","requested_at","created_at","updated_at"]);
  await upsert("purchase_orders", d.purchaseOrders, ["id","po_number","supplier_id","date","expected_date","total","status","notes","created_at","updated_at"]);
  await upsert("purchase_order_items", d.poItems||d.purchaseOrderItems, ["id","purchase_order_id","product_id","supplier_id","quantity","unit","unit_price","total","received_quantity","created_at","updated_at"]);
  await upsert("goods_receipts", d.goodsReceipts, ["id","purchase_order_id","received_by","date","total","status","created_at","updated_at"]);
  await upsert("goods_receipt_items", d.goodsReceiptItems, ["id","goods_receipt_id","po_item_id","quantity","unit","unit_cost","status","created_at","updated_at"]);
  await upsert("supplier_price_history", d.supplierPriceHistory, ["id","supplier_id","item_id","price","effective_date","reference","created_at","updated_at"]);
  await upsert("production_fixed_cost_categories", d.productionFixedCostCategories, ["id","name","description","active","created_at","updated_at"]);
  await upsert("production_fixed_cost_entries", d.productionFixedCostEntries, ["id","category_id","name","amount","frequency","effective_from","notes","created_at","updated_at"]);
  await upsert("production_wastage", d.productionWastage, ["id","job_id","item_id","quantity","unit","reason","cost","recorded_by","created_at","updated_at"]);
  await upsert("production_consumption", d.productionConsumption||d.productionConsumptions, ["id","job_id","item_id","quantity","unit","recipe_version","unit_cost","actual_cost","notes","created_at","updated_at"]);
  await upsert("production_costs", d.productionCosts, ["id","job_id","ingredient_cost","packaging_cost","labour_cost","overhead_cost","total","status","created_at","updated_at"]);
  await upsert("quality_checks", d.qualityChecks||d.productionQualityChecks, ["id","job_id","result","checked_by","checked_at","issues","notes","rework_required","rework_cost","wastage_caused","created_at","updated_at"]);
  await upsert("blog_categories", d.blogCategories, ["id","name","slug","description","display_order","active","created_at","updated_at"]);
  await upsert("blog_posts", d.blogPosts, ["id","category_id","title","slug","excerpt","body","cover_image","author","status","published_at","created_by","created_at","updated_at"]);
  await upsert("website_users", d.websiteUsers, ["id","name","email","phone","password_hash","role","status","customer_id","last_login_at","created_at","updated_at"]);
  // catalogue is stored as an object in store.json; migrate its arrays if present
  const cat = d.catalogue && typeof d.catalogue==='object' && !Array.isArray(d.catalogue) ? d.catalogue : {};
  await upsert("catalogue_categories", cat.categories||d.catalogueCategories, ["id","name","code","description","image","display_order","active","catalogue_visible","created_at","updated_at"]);
  await upsert("products", cat.products||d.catalogueProducts, ["id","sku","category_id","product_type_id","name","description","base_price","currency","cost_reference","catalogue_visible","production_enabled","image","created_at","updated_at"]);
  await upsert("product_variants", cat.variants||d.productVariants, ["id","product_id","name","type","default_value","created_at","updated_at"]);
  await upsert("production_steps", cat.productionSteps||d.productionSteps, ["id","job_id","name","step_order","status","started_at","completed_at","created_at","updated_at"]);

  console.log("Migration complete (idempotent upserts; existing rows preserved by conflict).");
  await pool.end();
}
main().catch(e=>{ console.error(e); process.exit(1); });
