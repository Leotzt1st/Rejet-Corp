export type Row = Record<string, unknown>;
export const MAX_CENTS = 99_999_999;
export const CHECKOUT_API_VERSION = "2026-03-25.dahlia";

export function object(value: unknown): Row {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}

export function providerId(value: unknown, prefix: string): string | null {
  const id = typeof value === "string" ? value : object(value).id;
  return typeof id === "string" && id.startsWith(prefix) && /^[A-Za-z0-9_]+$/.test(id) ? id : null;
}

export function uuid(value: unknown): value is string {
  return typeof value === "string" && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value);
}

export function cents(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > MAX_CENTS) {
    throw new Error("Invalid minor units");
  }
  return value;
}

export function checkoutMethods(requested: unknown, account: Row): string[] {
  const caps = object(account.capabilities);
  if (account.country !== "BR" || account.charges_enabled !== true || account.payouts_enabled !== true) return [];
  return ["card", "pix"].filter((method) =>
    Array.isArray(requested) && requested.includes(method) && caps[`${method}_payments`] === "active"
  );
}

export function paymentState(intent: Row, event: string): string {
  switch (intent.status) {
    case "succeeded": return "approved";
    case "processing":
    case "requires_capture": return "processing";
    case "canceled": return "cancelled";
    case "requires_payment_method":
      return intent.last_payment_error || event === "checkout.session.async_payment_failed" ? "declined" : "pending";
    default: return "pending";
  }
}

export function checkoutForm(order: Row, methods: string[], appOrigin: string) {
  if (!uuid(order.id) || methods.length === 0) throw new Error("Invalid checkout");
  const back = `${appOrigin}/financeiro?pedido=${order.id}`;
  const form = new URLSearchParams({
    mode: "payment",
    ui_mode: "form",
    billing_address_collection: "auto",
    "phone_number_collection[enabled]": "false",
    "automatic_tax[enabled]": "false",
    submit_type: "auto",
    integration_identifier: "custom_embedded_web_0001",
    "line_items[0][price_data][currency]": "brl",
    "line_items[0][price_data][unit_amount]": String(cents(order.amount_cents)),
    "line_items[0][price_data][product_data][name]": "Material negociado na Rejet Corp",
    "line_items[0][quantity]": "1",
    "metadata[rejet_order]": order.id,
    "payment_intent_data[metadata][rejet_order]": order.id,
    return_url: back,
  });
  const commission = cents(order.commission_cents);
  if (commission > cents(order.amount_cents)) throw new Error("Invalid platform fee");
  if (commission) form.set("payment_intent_data[application_fee_amount]", String(commission));
  for (const method of methods) form.append("payment_method_types[]", method);
  return form;
}

export function refundForm(order: Row, refund: Row) {
  const payment = providerId(order.gateway_payment, "pi_");
  if (!payment || !uuid(order.id) || !uuid(refund.id) || !cents(refund.amount_cents)) throw new Error("Invalid refund");
  return new URLSearchParams({
    payment_intent: payment,
    amount: String(refund.amount_cents),
    refund_application_fee: String(order.reverse_commission === true && cents(order.commission_cents) > 0),
    "metadata[rejet_refund]": refund.id,
    "metadata[rejet_order]": order.id,
  });
}

export async function signedEvent(payload: string, header: string, secret: string, now = Date.now()): Promise<boolean> {
  const pairs = header.split(",").map((pair) => pair.trim().split("="));
  const timestamp = pairs.find(([key]) => key === "t")?.[1];
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const signatures = pairs.filter(([key, value]) => key === "v1" && /^[\da-f]{64}$/i.test(value)).map(([, value]) => value);
  if (!signatures.length) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const data = encoder.encode(`${timestamp}.${payload}`);
  for (const signature of signatures) {
    const decoded = Uint8Array.from(signature.match(/../g) ?? [], (byte) => parseInt(byte, 16));
    if (await crypto.subtle.verify("HMAC", key, decoded, data)) return true;
  }
  return false;
}
