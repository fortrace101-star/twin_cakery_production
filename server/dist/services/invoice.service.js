import { withTransaction } from "../database/db.js";
import { store } from "../database/store.js";
import { makeId } from "../utils/make-id.js";
export const invoiceService = {
    async ensureInvoice(orderId) {
        return withTransaction(async (tx) => {
            // check existing
            const existing = await tx.query("SELECT * FROM invoices WHERE order_id=$1", [orderId]);
            if ((existing.rows || existing)[0]) {
                return (existing.rows || existing)[0];
            }
            const orderRes = await tx.query("SELECT * FROM orders WHERE id=$1", [orderId]);
            const order = (orderRes.rows || orderRes)[0];
            if (!order)
                throw new Error("Order not found");
            // get next invoice number
            const year = new Date().getFullYear();
            const cntRes = await tx.query(`INSERT INTO document_counters (kind, year, last_no) VALUES ('INV',$1,1)
         ON CONFLICT (kind, year) DO UPDATE SET last_no = document_counters.last_no + 1 RETURNING last_no`, [year]);
            const lastNo = (cntRes.rows || cntRes)[0]?.last_no || 1;
            const invoiceNo = `INV-${year}-${String(lastNo).padStart(5, "0")}`;
            const invId = makeId("inv");
            const subtotal = Number(order.subtotal || 0);
            const taxRate = Number(order.tax_rate || 0);
            const taxAmount = Number(order.tax_amount || 0);
            const deliveryCharge = Number(order.delivery_charge || 0);
            const discount = Number(order.discount || 0);
            const total = Number(order.total || subtotal + taxAmount + deliveryCharge - discount);
            const invRes = await tx.query(`INSERT INTO invoices (id, invoice_no, order_id, customer_id, status, issue_date, due_date, currency, subtotal, tax_rate, tax_amount, delivery_charge, discount, total)
         VALUES ($1,$2,$3,$4,'ISSUED',CURRENT_DATE,CURRENT_DATE + INTERVAL '7 days','UGX',$5,$6,$7,$8,$9,$10)
         RETURNING *`, [invId, invoiceNo, orderId, order.customer_id, subtotal, taxRate, taxAmount, deliveryCharge, discount, total]);
            const invoice = (invRes.rows || invRes)[0];
            // add lines from order items
            const itemsRes = await tx.query("SELECT * FROM order_items WHERE order_id=$1", [orderId]);
            const items = itemsRes.rows || itemsRes || [];
            for (const item of items) {
                await tx.query(`INSERT INTO invoice_lines (invoice_id, description, quantity, unit_price, total)
           VALUES ($1,$2,$3,$4,$5)`, [invId, item.product_name || item.description || "Item", item.quantity || 1, item.unit_price || item.price || 0, item.line_total || (item.quantity || 1) * (item.unit_price || item.price || 0)]);
            }
            try {
                store.persist();
            }
            catch { }
            return invoice;
        });
    },
};
//# sourceMappingURL=invoice.service.js.map