export const modules = [
  { id: 'crm', label: 'Customers & CRM', icon: 'Users', group: 'WORKSPACE', tabs: ['Customers', 'Inquiries', 'Interactions', 'Feedback'] },
  { id: 'sales', label: 'Sales & orders', icon: 'ShoppingBag', group: 'WORKSPACE', tabs: ['Orders', 'Quotations', 'Sales analytics'] },
  { id: 'catalogue', label: 'Product catalogue', icon: 'CakeSlice', group: 'WORKSPACE', tabs: ['Products', 'Categories', 'Product types', 'Variants'] },
  { id: 'webapp', label: 'Web App Management', icon: 'Globe', group: 'WORKSPACE', tabs: ['Overview', 'Blog posts', 'Website users'] },
  { id: 'production', label: 'Production', icon: 'ChefHat', group: 'OPERATIONS', tabs: ['Schedule', 'Jobs', 'Quality control', 'Production costs'] },
  { id: 'inventory', label: 'Inventory', icon: 'Boxes', group: 'OPERATIONS', tabs: ['Stock', 'Reservations', 'Transactions', 'Adjustments', 'Alerts'] },
  { id: 'purchasing', label: 'Purchasing', icon: 'Truck', group: 'OPERATIONS', tabs: ['Purchase orders', 'Suppliers', 'Requirements', 'Goods received'] },
  { id: 'delivery', label: 'Deliveries', icon: 'MapPin', group: 'OPERATIONS', tabs: ['Upcoming', 'Dispatch', 'Completed'] },
  { id: 'finance', label: 'Finance', icon: 'Wallet', group: 'BUSINESS', tabs: ['Payments', 'Expenses', 'Profitability', 'Reports'] },
  { id: 'analytics', label: 'Analytics', icon: 'ChartNoAxesCombined', group: 'BUSINESS', tabs: ['Overview', 'Sales trends', 'Customers', 'Product performance'] },
  { id: 'administration', label: 'Settings', icon: 'Settings', group: 'BUSINESS', tabs: ['Business settings', 'Users', 'Roles', 'Permissions', 'Audit log'] },
] as const;
export type Order = { id: string; customer: string; initials: string; product: string; options: string; date: string; time: string; amount: number; status: string; payment: string; delivery: string; channel: string; };
export const initialOrders: Order[] = [
  { id: 'TC-1048', customer: 'Sarah Mwangi', initials: 'SM', product: 'Chocolate celebration cake', options: '2 kg · Chocolate · Birthday', date: '2026-10-07', time: '10:00 AM', amount: 4500, status: 'In production', payment: 'Partially paid', delivery: 'Pending', channel: 'WhatsApp' },
  { id: 'TC-1047', customer: 'David Ochieng', initials: 'DO', product: 'Red velvet cake', options: '1.5 kg · Red velvet · Anniversary', date: '2026-10-07', time: '11:30 AM', amount: 3800, status: 'Ready', payment: 'Paid', delivery: 'Awaiting dispatch', channel: 'Website' },
  { id: 'TC-1046', customer: 'Grace Wanjiku', initials: 'GW', product: 'Vanilla cupcakes', options: '24 pieces · Vanilla · Corporate', date: '2026-10-07', time: '01:00 PM', amount: 2400, status: 'Confirmed', payment: 'Paid', delivery: 'Pending', channel: 'Phone' },
  { id: 'TC-1045', customer: 'James Kamau', initials: 'JK', product: 'Wedding cake', options: '3 tiers · Vanilla & lemon', date: '2026-10-08', time: '09:00 AM', amount: 18000, status: 'In production', payment: 'Partially paid', delivery: 'Pending', channel: 'Walk-in' },
  { id: 'TC-1044', customer: 'Faith Akinyi', initials: 'FA', product: 'Carrot cake', options: '1 kg · Cream cheese frosting', date: '2026-10-08', time: '02:00 PM', amount: 3200, status: 'Pending confirmation', payment: 'Unpaid', delivery: 'Pending', channel: 'WhatsApp' },
  { id: 'TC-1043', customer: 'Peter Njoroge', initials: 'PN', product: 'Chocolate cupcakes', options: '12 pieces · Chocolate', date: '2026-10-09', time: '10:30 AM', amount: 1800, status: 'Completed', payment: 'Paid', delivery: 'Delivered', channel: 'Website' },
];
export const stock = [
  { name: 'All-purpose flour', sku: 'ING-001', category: 'Dry ingredients', quantity: 8, unit: 'kg', min: 15, cost: 120, status: 'Low stock' },
  { name: 'Unsalted butter', sku: 'ING-002', category: 'Dairy', quantity: 2.5, unit: 'kg', min: 5, cost: 850, status: 'Low stock' },
  { name: 'Cocoa powder', sku: 'ING-003', category: 'Dry ingredients', quantity: 1.2, unit: 'kg', min: 3, cost: 950, status: 'Low stock' },
  { name: 'Granulated sugar', sku: 'ING-004', category: 'Dry ingredients', quantity: 24, unit: 'kg', min: 10, cost: 180, status: 'In stock' },
  { name: 'Fresh eggs', sku: 'ING-005', category: 'Fresh ingredients', quantity: 90, unit: 'pcs', min: 30, cost: 18, status: 'In stock' },
  { name: 'Whipping cream', sku: 'ING-006', category: 'Dairy', quantity: 8, unit: 'L', min: 4, cost: 650, status: 'In stock' },
];
export const money = (amount: number) => 'UGX ' + amount.toLocaleString('en-UG', { maximumFractionDigits: 0 });
import { toneOf } from "../../lib/theme-tokens";
export function tone(status: string) {
  // Single source: design-system status vocabulary (erp_design.md C2-C4).
  return toneOf(status);
}

// Terminal order statuses: an order that has reached one of these is no longer
// "active" (it drops out of the working/active lists) but is retained for
// history, analytics and the audit trail. Keep this the single source of truth
// so the active-order surfaces (dashboard, sales Orders tab, delivery) never drift.
export const TERMINAL_ORDER_STATUSES = ["Completed", "Cancelled"] as const;

export function isActiveOrder(order: Pick<Order, "status">): boolean {
  return !TERMINAL_ORDER_STATUSES.includes(order.status as (typeof TERMINAL_ORDER_STATUSES)[number]);
}
export type GridRow = { id: string; name: string; detail: string; secondary: string; value: string; status: string };
export function moduleRows(module: string, tab: string, orders: Order[]): GridRow[] {
  if (module === 'crm') return orders.map((o, i) => ({ id: tab === 'Inquiries' ? `INQ-00${i+1}` : `CUS-00${i+1}`, name: o.customer, detail: tab === 'Feedback' ? ['“Beautiful cake and excellent service!”', '“Delivered on time. Thank you!”', '“The cupcakes were a hit.”'][i%3] || '' : o.channel + ' · ' + (i+1) + ' orders', secondary: tab === 'Inquiries' ? o.product : '07 Oct 2026', value: tab === 'Feedback' ? '★★★★★' : money(o.amount), status: tab === 'Inquiries' ? ['New', 'Follow-up', 'Quoted'][i%3] || 'New' : 'Active' }));
  if (module === 'inventory') return stock.map((s,i) => ({ id: tab === 'Transactions' ? `TXN-00${i+1}` : s.sku, name: s.name, detail: s.category, secondary: tab === 'Transactions' ? ['Purchase', 'Consumption', 'Adjustment'][i%3] || 'Purchase' : `Reorder at ${s.min} ${s.unit}`, value: `${s.quantity} ${s.unit}`, status: s.status }));
  if (module === 'purchasing') return [{id:'PO-0028',name:'Bakers Supply Co.',detail:'Flour, cocoa powder · 3 items',secondary:'09 Oct 2026',value:money(12400),status:'Sent'}, {id:'PO-0027',name:'Fresh Dairy Uganda',detail:'Unsalted butter, cream · 2 items',secondary:'08 Oct 2026',value:money(9800),status:'Approved'}, {id:'PO-0026',name:'Packaging House',detail:'Cake boxes, boards · 4 items',secondary:'06 Oct 2026',value:money(6400),status:'Completed'}];
  if (module === 'production') return orders.slice(0,5).map((o,i)=>({id:`JOB-00${48-i}`,name:o.product,detail:o.id+' · Recipe v1.2',secondary:o.time,value:tab === 'Production costs' ? money(o.amount * .35) : ['Baking','Decorating','Queued','Baking','Queued'][i] || 'Queued',status:tab==='Quality control' ? (i%2 ? 'Passed':'Pending') : o.status}));
  if (module === 'delivery') return orders.filter(o=> tab === 'Completed' ? o.delivery==='Delivered' : isActiveOrder(o)).map(o=>({id:o.id,name:o.customer,detail:o.product,secondary:o.time,value:'Kampala · Delivery',status:o.delivery}));
  if (module === 'finance') return orders.map(o=>({id:tab==='Expenses' ? o.id.replace('TC','EXP'):o.id,name:tab==='Expenses' ? 'Ingredient procurement':o.customer,detail:tab==='Expenses'?'Production · Ingredients':o.product,secondary:'07 Oct 2026',value:money(tab==='Expenses'?o.amount*.3:o.amount),status:tab==='Expenses'?'Paid':o.payment}));
  if (module === 'sales') return orders.map(o=>({id:o.id.replace('TC','QT'),name:o.customer,detail:o.product,secondary:o.date,value:money(o.amount),status:o.status==='Pending confirmation'?'Accepted':'Sent'}));
  return [];
}
