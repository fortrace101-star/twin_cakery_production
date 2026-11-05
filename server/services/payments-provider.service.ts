export interface PaymentProvider {
  name: "MTN_MOMO" | "AIRTEL_MONEY" | "STUB";
  requestToPay(req: { amount: number; msisdn: string; reference: string; callbackUrl: string }): Promise<{ providerRef: string }>;
  verifyWebhook(headers: Record<string, string>, rawBody: Buffer): { valid: boolean; providerRef: string; status: "SUCCESS" | "FAILED"; amount: number };
}

class StubProvider implements PaymentProvider {
  name = "STUB" as const;
  async requestToPay(req: any) {
    return { providerRef: `STUB-${Date.now()}` };
  }
  verifyWebhook() {
    return { valid: true, providerRef: "", status: "SUCCESS" as const, amount: 0 };
  }
}

export function getPaymentProvider(): PaymentProvider {
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
