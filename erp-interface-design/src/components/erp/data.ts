export const modules = [
  { id: 'crm', label: 'Customers & CRM', icon: 'Users', group: 'WORKSPACE', tabs: ['Customers', 'Occasions', 'Inquiries', 'Interactions', 'Feedback'] },
  { id: 'sales', label: 'Sales & orders', icon: 'ShoppingBag', group: 'WORKSPACE', tabs: ['Orders', 'Order history', 'Quotations', 'Sales analytics'] },
  { id: 'catalogue', label: 'Product catalogue', icon: 'CakeSlice', group: 'WORKSPACE', tabs: ['Products', 'Categories', 'Product types', 'Variants'] },
  { id: 'webapp', label: 'Site Management', icon: 'Globe', group: 'WORKSPACE', tabs: ['Overview', 'Product catalog', 'Website users'] },
  { id: 'production', label: 'Production', icon: 'ChefHat', group: 'OPERATIONS', tabs: ['Schedule', 'Jobs', 'Quality control', 'Production costs'] },
  { id: 'inventory', label: 'Inventory', icon: 'Boxes', group: 'OPERATIONS', tabs: ['Stock', 'Reservations', 'Transactions', 'Adjustments', 'Alerts'] },
  { id: 'purchasing', label: 'Purchasing', icon: 'Truck', group: 'OPERATIONS', tabs: ['Purchase orders', 'Suppliers', 'Requirements', 'Goods received'] },
  { id: 'delivery', label: 'Deliveries', icon: 'MapPin', group: 'OPERATIONS', tabs: ['Upcoming', 'Dispatch', 'Completed'] },
  { id: 'finance', label: 'Finance', icon: 'Wallet', group: 'BUSINESS', tabs: ['Payments', 'Expenses', 'Profitability', 'Reports'] },
  { id: 'analytics', label: 'Analytics', icon: 'ChartNoAxesCombined', group: 'BUSINESS', tabs: ['Overview', 'Order history', 'Sales trends', 'Customers', 'Product performance'] },
  { id: 'administration', label: 'Settings', icon: 'Settings', group: 'BUSINESS', tabs: ['Business settings', 'Users', 'Roles', 'Permissions', 'Audit log'] },
] as const;

/**
 * Permission required to see each module in the navigation (E5:
 * "Navigation must be permission-aware", Updated doc §4). The Dashboard
 * entry lives outside `modules` and stays visible for everyone.
 */
export const MODULE_PERMISSIONS: Record<string, string> = {
  crm: 'customers.view',
  sales: 'orders.view',
  catalogue: 'catalogue.view',
  webapp: 'content.view',
  production: 'production.view',
  inventory: 'inventory.view',
  purchasing: 'purchasing.view',
  delivery: 'deliveries.view',
  finance: 'finance.view',
  analytics: 'sales.analytics',
  administration: 'users.manage',
};

/**
 * Modules a permission set may see.
 * - `null` (interface preview / not signed in) → show everything.
 * - An array → keep every module whose mapped permission is granted
 *   (modules without a mapping are always visible).
 */
export function visibleModules<T extends { id: string }>(mods: readonly T[], permissions: string[] | null): readonly T[] {
  if (permissions === null) return mods;
  return mods.filter((m) => {
    const need = MODULE_PERMISSIONS[m.id];
    return !need || permissions.includes(need);
  });
}

export type Order = { id: string; customer: string; initials: string; product: string; options: string; date: string; time: string; amount: number; status: string; payment: string; paymentNote?: string; delivery: string; channel: string; followUpCompletedAt?: string | null; /** Amount paid at order creation / last payment record. */ paidAmount?: number; /** Delivery location fields (Stage 5). */ deliveryLocation?: string; locationNote?: string; };
export const initialOrders: Order[] = [
  { id: 'TC-1048', customer: 'Sarah Mwangi', initials: 'SM', product: 'Chocolate celebration cake', options: '2 kg · Chocolate · Birthday', date: '2026-10-07', time: '10:00 AM', amount: 4500, paidAmount: 1500, status: 'In production', payment: 'Partially paid', delivery: 'Pending', channel: 'WhatsApp' },
  { id: 'TC-1047', customer: 'David Ochieng', initials: 'DO', product: 'Red velvet cake', options: '1.5 kg · Red velvet · Anniversary', date: '2026-10-07', time: '11:30 AM', amount: 3800, status: 'Ready', payment: 'Paid', delivery: 'Awaiting dispatch', channel: 'Website' },
  { id: 'TC-1046', customer: 'Grace Wanjiku', initials: 'GW', product: 'Vanilla cupcakes', options: '24 pieces · Vanilla · Corporate', date: '2026-10-07', time: '01:00 PM', amount: 2400, status: 'Confirmed', payment: 'Paid', delivery: 'Pending', channel: 'Phone' },
  { id: 'TC-1045', customer: 'James Kamau', initials: 'JK', product: 'Wedding cake', options: '3 tiers · Vanilla & lemon', date: '2026-10-08', time: '09:00 AM', amount: 18000, status: 'In production', payment: 'Partially paid', delivery: 'Pending', channel: 'Walk-in' },
  { id: 'TC-1044', customer: 'Faith Akinyi', initials: 'FA', product: 'Carrot cake', options: '1 kg · Cream cheese frosting', date: '2026-10-08', time: '02:00 PM', amount: 3200, status: 'Pending confirmation', payment: 'Unpaid', delivery: 'Pending', channel: 'WhatsApp' },
  { id: 'TC-1043', customer: 'Peter Njoroge', initials: 'PN', product: 'Chocolate cupcakes', options: '12 pieces · Chocolate', date: '2026-10-09', time: '10:30 AM', amount: 1800, status: 'Completed / Delivered', payment: 'Paid', delivery: 'Completed / Delivered', channel: 'Website' },
];
export const stock = [
  { name: 'All-purpose flour', sku: 'ING-001', category: 'Dry ingredients', quantity: 8, unit: 'kg', min: 15, cost: 120, status: 'Low stock' },
  { name: 'Unsalted butter', sku: 'ING-002', category: 'Dairy', quantity: 2.5, unit: 'kg', min: 5, cost: 850, status: 'Low stock' },
  { name: 'Cocoa powder', sku: 'ING-003', category: 'Dry ingredients', quantity: 1.2, unit: 'kg', min: 3, cost: 950, status: 'Low stock' },
  { name: 'Granulated sugar', sku: 'ING-004', category: 'Dry ingredients', quantity: 24, unit: 'kg', min: 10, cost: 180, status: 'In stock' },
  { name: 'Fresh eggs', sku: 'ING-005', category: 'Fresh ingredients', quantity: 90, unit: 'pcs', min: 30, cost: 18, status: 'In stock' },
  { name: 'Whipping cream', sku: 'ING-006', category: 'Dairy', quantity: 8, unit: 'L', min: 4, cost: 650, status: 'In stock' },
];
import { orderStageTone } from "../../lib/theme-tokens";
/* ── CRM: occasions (customer events shown on the Occasions tab) ─────── */

export type Occasion = { id: string; customer: string; type: string; date: string; recurrence: string };

/** Sample occasions shown when the workspace is not connected to the API. */
export const initialOccasions: Occasion[] = [
  { id: 'OCC-001', customer: 'Sarah Mwangi', type: 'Birthday', date: '2026-10-18', recurrence: 'ANNUAL' },
  { id: 'OCC-002', customer: 'David Ochieng', type: 'Wedding anniversary', date: '2026-10-24', recurrence: 'ANNUAL' },
  { id: 'OCC-003', customer: 'Faith Akinyi', type: 'Birthday', date: '2026-10-31', recurrence: 'MONTHLY' },
  { id: 'OCC-004', customer: 'Grace Wanjiku', type: 'Birthday', date: '2026-11-02', recurrence: 'ANNUAL' },
  { id: 'OCC-005', customer: 'James Kamau', type: 'Graduation', date: '2026-11-06', recurrence: 'NONE' },
  { id: 'OCC-006', customer: 'Sarah Mwangi', type: 'Corporate tasting day', date: '2026-11-13', recurrence: 'ANNUAL' },
  { id: 'OCC-007', customer: 'Peter Njoroge', type: 'Baby shower', date: '2026-12-03', recurrence: 'NONE' },
];

export type OccasionPeriod = 'Month' | 'Week' | 'Custom';

export type OccasionGroup = { key: string; label: string; items: Occasion[] };

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Parse a YYYY-MM-DD string as a LOCAL date (avoids the UTC off-by-one). */
function localDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Format a YYYY-MM-DD string as "18 Oct 2026" (no timezone involved). */
export function formatOccasionDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${Number(d)} ${MONTH_SHORT[Number(m) - 1] ?? ''} ${y}`;
}

/**
 * Group occasions for the CRM "Occasions" tab. Month (the default) buckets by
 * calendar month ("October 2026"); Week buckets by Monday-start week ("Week of
 * 12 Oct 2026"); Custom keeps only items inside [from, to] (inclusive,
 * YYYY-MM-DD) and buckets by day ("Sun 18 Oct 2026"). Groups and items are
 * always sorted ascending by date; invalid dates are dropped.
 */
export function groupOccasions(occasions: Occasion[], period: OccasionPeriod = 'Month', range?: { from: string; to: string }): OccasionGroup[] {
  const dated = occasions
    .filter((o) => /^\d{4}-\d{2}-\d{2}$/.test(o.date))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.customer.localeCompare(b.customer));
  const groups = new Map<string, OccasionGroup>();
  for (const o of dated) {
    const dt = localDate(o.date);
    let key: string;
    let label: string;
    if (period === 'Week') {
      const monday = new Date(dt);
      monday.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
      key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      label = `Week of ${monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    } else if (period === 'Custom') {
      if (range && (o.date < range.from || o.date > range.to)) continue;
      key = o.date;
      label = dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    } else {
      key = o.date.slice(0, 7);
      label = dt.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    }
    const group = groups.get(key) ?? { key, label, items: [] };
    group.items.push(o);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function tone(status: string) {
  // Single source: order-stage hues first, then the design-system status
  // vocabulary (erp_design.md C2-C4). Never map a stage colour here by hand —
  // ORDER_STAGE_TONES in theme-tokens.ts is the one place that decides.
  return orderStageTone(status);
}
export const money = (amount: number) => 'UGX ' + amount.toLocaleString('en-UG', { maximumFractionDigits: 0 });

// Terminal order statuses: an order that has reached one of these is no longer
// "active" (it drops out of the working/active lists) but is retained for
// history, analytics and the audit trail. Keep this the single source of truth
// so the active-order surfaces (dashboard, sales Orders tab, delivery) never drift.
// Their dedicated home in the UI is Sales > "Order history" (terminal orders only).
export const TERMINAL_ORDER_STATUSES = ["Completed / Delivered", "Cancelled"] as const;
// Stage palette — the 6 in-flight stages each get their OWN hue so the
// breakdown reads as six distinct steps rather than three pastels repeated.
// Kept in sync with ORDER_STAGE_TONES in theme-tokens.ts (badges + order-row
// tints read from there); these two tables add the legend class and donut fill.
const ORDER_STAGE_HUES: Record<OrderBreakdownStatus, string> = {
  "Pending confirmation": "green",
  Confirmed: "blue",
  "In production": "violet",
  Ready: "teal",
  "Awaiting Collection": "amber",
  "In Transit": "orange",
};

// Legend swatch class per status (see .legend-* in styles.css).
const ORDER_BREAKDOWN_SWATCH: Record<OrderBreakdownStatus, string> = ORDER_STAGE_HUES;

// Donut arc fill per status. Kept as CSS vars so light/dark themes both work.
const ORDER_BREAKDOWN_ARC: Record<OrderBreakdownStatus, string> = {
  "Pending confirmation": "var(--green-solid)",
  Confirmed: "var(--blue-solid)",
  "In production": "var(--violet-solid)",
  Ready: "var(--teal-solid)",
  "Awaiting Collection": "var(--peach-solid)",
  "In Transit": "var(--orange-solid)",
};

export function isActiveOrder(order: Pick<Order, "status">): boolean {
  return !TERMINAL_ORDER_STATUSES.includes(order.status as (typeof TERMINAL_ORDER_STATUSES)[number]);
}

// ---------------------------------------------------------------------------
// Order breakdown (dashboard donut + sidebar badge)
// ---------------------------------------------------------------------------
// The dashboard donut and the sidebar "Sales & orders" badge used to show a
// hard-coded 24 that was disconnected from the data (the real active count is
// 5). Both now derive from this single helper so they can never disagree, and
// so they follow the same active-order rule as the order tables (terminal
// statuses are excluded, but stay available via the explicit status filter).
// The Order breakdown card shows the in-flight pipeline only. Completed /
// Delivered and Cancelled orders live in Order history, so they are excluded
// here — the donut tracks live work, not finished work.
export const ORDER_BREAKDOWN_STATUSES = [
  "Pending confirmation",
  "Confirmed",
  "In production",
  "Ready",
  "Awaiting Collection",
  "In Transit",
] as const;
export type OrderBreakdownStatus = (typeof ORDER_BREAKDOWN_STATUSES)[number];

export type OrderBreakdownSegment = { status: OrderBreakdownStatus; count: number; outstandingAmount: number };
export type OrderBreakdown = { total: number; segments: OrderBreakdownSegment[] };

/** Outstanding = amount − paidAmount (never below zero); 0 for fully-paid orders. */
export function orderOutstandingAmount(order: Pick<Order, "amount" | "payment" | "paidAmount">): number {
  if (order.payment === "Paid") return 0;
  return Math.max(order.amount - (order.paidAmount ?? 0), 0);
}
export function orderBreakdown(orders: Order[]): OrderBreakdown {
  const segments = ORDER_BREAKDOWN_STATUSES.map((status) => {
    const list = orders.filter((o) => o.status === status);
    return {
      status,
      count: list.length,
      outstandingAmount: list.reduce((sum, o) => sum + orderOutstandingAmount(o), 0),
    };
  });
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  return { total, segments };
}

export function breakdownSwatchClass(status: string): string {
  return ORDER_BREAKDOWN_SWATCH[status as OrderBreakdownStatus] ?? "violet";
}

// Label used in the donut legend (shorter than the raw status where useful).
export function breakdownLabel(status: string): string {
  return status === "Ready" ? "Ready to deliver" : status;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Builds the conic-gradient for the donut: one arc per non-empty status, with a
// thin card-coloured separator between arcs. Falls back to an empty ring when
// there are no active orders.
export function donutGradient(breakdown: OrderBreakdown): string {
  const shown = breakdown.segments.filter((s) => s.count > 0);
  if (breakdown.total <= 0 || shown.length === 0) {
    return "conic-gradient(var(--card) 0deg 360deg)";
  }
  const gap = 4; // degrees of separator between arcs
  const usable = Math.max(360 - gap * shown.length, 1);
  const stops: string[] = [];
  let angle = 0;
  for (const segment of shown) {
    const sweep = (segment.count / breakdown.total) * usable;
    stops.push(`${ORDER_BREAKDOWN_ARC[segment.status] ?? "var(--muted)"} ${round2(angle)}deg ${round2(angle + sweep)}deg`);
    angle += sweep;
    stops.push(`var(--card) ${round2(angle)}deg ${round2(angle + gap)}deg`);
    angle += gap;
  }
  if (angle < 359.9) stops.push(`var(--card) ${round2(angle)}deg 360deg`);
  return `conic-gradient(${stops.join(",")})`;
}
export type GridRow = { id: string; name: string; detail: string; secondary: string; value: string; status: string };
export function moduleRows(module: string, tab: string, orders: Order[]): GridRow[] {
  if (module === 'crm') return orders.map((o, i) => ({ id: tab === 'Inquiries' ? `INQ-00${i+1}` : `CUS-00${i+1}`, name: o.customer, detail: tab === 'Feedback' ? ['“Beautiful cake and excellent service!”', '“Delivered on time. Thank you!”', '“The cupcakes were a hit.”'][i%3] || '' : o.channel + ' · ' + (i+1) + ' orders', secondary: tab === 'Inquiries' ? o.product : '07 Oct 2026', value: tab === 'Feedback' ? '★★★★★' : money(o.amount), status: tab === 'Inquiries' ? ['New', 'Follow-up', 'Quoted'][i%3] || 'New' : 'Active' }));
  if (module === 'inventory') return stock.map((s,i) => ({ id: tab === 'Transactions' ? `TXN-00${i+1}` : s.sku, name: s.name, detail: s.category, secondary: tab === 'Transactions' ? ['Purchase', 'Consumption', 'Adjustment'][i%3] || 'Purchase' : `Reorder at ${s.min} ${s.unit}`, value: `${s.quantity} ${s.unit}`, status: s.status }));
  if (module === 'purchasing') return [{id:'PO-0028',name:'Bakers Supply Co.',detail:'Flour, cocoa powder · 3 items',secondary:'09 Oct 2026',value:money(12400),status:'Sent'}, {id:'PO-0027',name:'Fresh Dairy Uganda',detail:'Unsalted butter, cream · 2 items',secondary:'08 Oct 2026',value:money(9800),status:'Approved'}, {id:'PO-0026',name:'Packaging House',detail:'Cake boxes, boards · 4 items',secondary:'06 Oct 2026',value:money(6400),status:'Completed'}];
  if (module === 'production') return orders.slice(0,5).map((o,i)=>({id:`JOB-00${48-i}`,name:o.product,detail:o.id+' · Recipe v1.2',secondary:o.time,value:tab === 'Production costs' ? money(o.amount * .35) : ['Baking','Decorating','Queued','Baking','Queued'][i] || 'Queued',status:tab==='Quality control' ? (i%2 ? 'Passed':'Pending') : o.status}));
  if (module === 'delivery') return orders.filter(o=> tab === 'Completed' ? o.delivery==='Completed / Delivered' : isActiveOrder(o)).map(o=>({id:o.id,name:o.customer,detail:o.product,secondary:o.time,value:'Kampala · Delivery',status:o.delivery}));
  if (module === 'finance') return orders.map(o=>({id:tab==='Expenses' ? o.id.replace('TC','EXP'):o.id,name:tab==='Expenses' ? 'Ingredient procurement':o.customer,detail:tab==='Expenses'?'Production · Ingredients':o.product,secondary:'07 Oct 2026',value:money(tab==='Expenses'?o.amount*.3:o.amount),status:tab==='Expenses'?'Paid':o.payment}));
  if (module === 'sales') return orders.map(o=>({id:o.id.replace('TC','QT'),name:o.customer,detail:o.product,secondary:o.date,value:money(o.amount),status:o.status==='Pending confirmation'?'Accepted':'Sent'}));
  return [];
}
