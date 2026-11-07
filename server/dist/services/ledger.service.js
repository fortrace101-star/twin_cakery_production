function sum(lines, key) {
    return lines.reduce((s, l) => s + Number(l[key] || 0), 0);
}
export const ledgerService = {
    async post(tx, e) {
        const d = sum(e.lines, "debit");
        const c = sum(e.lines, "credit");
        if (d !== c) {
            throw new Error(`Unbalanced journal ${e.type}:${e.id} (${d} ≠ ${c})`);
        }
        const date = e.date || new Date().toISOString().slice(0, 10);
        const period = date.slice(0, 7);
        await tx.query(`INSERT INTO accounting_periods (period) VALUES ($1) ON CONFLICT DO NOTHING`, [period]);
        const jeRes = await tx.query(`INSERT INTO journal_entries (entry_date, period, source_event_id, source_type, source_id, memo)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (source_type, source_id, memo) DO NOTHING RETURNING id`, [date, period, e.eventId || null, e.type, e.id, e.memo]);
        const je = jeRes.rows?.[0] || jeRes[0];
        if (!je)
            return; // already posted
        for (const l of e.lines) {
            await tx.query(`INSERT INTO journal_lines (entry_id, account_code, debit, credit, order_id, customer_id, job_id, supplier_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [je.id, l.account, l.debit ?? 0, l.credit ?? 0, l.orderId || null, l.customerId || null, l.jobId || null, l.supplierId || null]);
        }
    },
    async postPayment(tx, payment) {
        // Simple posting: Dr Cash/receivable based on method, Cr Customer deposits or AR
        // Default to 1020 Mobile money / 1010 Cash on hand as appropriate
        const method = payment.method || "Cash";
        let debitAccount = "1010"; // Cash on hand
        if (method === "MTN MoMo" || method === "Airtel Money" || method === "M-Pesa")
            debitAccount = "1020";
        if (method === "Bank Transfer")
            debitAccount = "1030";
        if (payment.delivery_id)
            debitAccount = "1015"; // Cash with drivers
        await this.post(tx, {
            type: "payment.recorded",
            id: payment.id,
            memo: `Payment ${payment.id} for order ${payment.order_id}`,
            lines: [
                { account: debitAccount, debit: Number(payment.amount || 0), orderId: payment.order_id },
                { account: "2010", credit: Number(payment.amount || 0), orderId: payment.order_id }, // Customer deposits (simplified)
            ],
        });
    },
};
//# sourceMappingURL=ledger.service.js.map