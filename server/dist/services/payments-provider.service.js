class StubProvider {
    name = "STUB";
    async requestToPay(req) {
        return { providerRef: `STUB-${Date.now()}` };
    }
    verifyWebhook() {
        return { valid: true, providerRef: "", status: "SUCCESS", amount: 0 };
    }
}
export function getPaymentProvider() {
    const p = process.env.PAYMENT_PROVIDER || "stub";
    if (p === "mtn" || p === "MTN_MOMO") {
        return new StubProvider();
    }
    if (p === "airtel" || p === "AIRTEL_MONEY") {
        return new StubProvider();
    }
    return new StubProvider();
}
export const paymentProvider = getPaymentProvider();
//# sourceMappingURL=payments-provider.service.js.map