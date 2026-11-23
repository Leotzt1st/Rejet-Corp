import { checkoutForm, checkoutMethods, paymentState, refundForm, signedEvent } from "./stripe.ts";
import assert from "node:assert/strict";

const order = { id: "20000000-0000-4000-8000-000000000001", amount_cents: 10001, commission_cents: 500,
  gateway_payment: "pi_example", reverse_commission: true };

Deno.test("checkout sends exact minor units, real commission and one line item", () => {
  const payload = checkoutForm(order, ["card","pix"], "https://example.invalid");
  assert.equal(payload.get("line_items[0][price_data][unit_amount]"), "10001");
  assert.equal(payload.get("line_items[0][quantity]"), "1");
  assert.equal(payload.get("payment_intent_data[application_fee_amount]"), "500");
  assert.equal(payload.get("metadata[rejet_order]"), order.id);
  assert.equal(payload.get("payment_intent_data[metadata][rejet_order]"), order.id);
  assert.deepEqual(payload.getAll("payment_method_types[]"), ["card", "pix"]);
  assert.deepEqual(Object.fromEntries([...payload].filter(([key]) => !key.includes("[") || key.endsWith("[enabled]"))), {
    mode: "payment",
    ui_mode: "form",
    billing_address_collection: "auto",
    "phone_number_collection[enabled]": "false",
    "automatic_tax[enabled]": "false",
    submit_type: "auto",
    integration_identifier: "custom_embedded_web_0001",
    return_url: `https://example.invalid/financeiro?pedido=${order.id}`,
  });
  assert.throws(() => checkoutForm({ ...order, amount_cents: 80.1 }, ["card"], "https://example.invalid"));
});

Deno.test("only configured and active Brazilian account methods are returned", () => {
  const acct = { country:"BR", charges_enabled:true,payouts_enabled:true,capabilities:{card_payments:"active",pix_payments:"pending",boleto_payments:"active"} };
  assert.deepEqual(checkoutMethods(["card","pix","boleto"],acct), ["card"]);
  assert.deepEqual(checkoutMethods(["card"],{...acct,payouts_enabled:false}), []);
  assert.deepEqual(checkoutMethods(["card"],{...acct,country:"US"}), []);
  assert.deepEqual(checkoutMethods(["pix"],{...acct,capabilities:{pix_payments:"active"}}), ["pix"]);
});

Deno.test("provider states never imply approval on a browser return or pending intent", () => {
  assert.equal(paymentState({status:"requires_action"},"checkout.session.completed"),"pending");
  assert.equal(paymentState({status:"processing"},"checkout.session.completed"),"processing");
  assert.equal(paymentState({status:"requires_payment_method",last_payment_error:{code:"card_declined"}},""),"declined");
  assert.equal(paymentState({status:"canceled"},""),"cancelled");
  assert.equal(paymentState({status:"succeeded"},"payment_intent.payment_failed"),"approved");
});

Deno.test("direct refund requests proportional reversal without destination-transfer options", () => {
  const refund = {id:"20000000-0000-4000-8000-000000000002", amount_cents:2574};
  const payload = refundForm(order, refund);
  assert.equal(payload.get("refund_application_fee"),"true");
  assert.equal(payload.get("amount"),"2574");
  assert.equal(payload.get("payment_intent"),"pi_example");
  assert.equal(payload.has("reverse_transfer"),false);
  assert.equal(refundForm({...order,reverse_commission:false},refund).get("refund_application_fee"),"false");
});

Deno.test("webhook signature checks the raw body, tolerates rotation, rejects stale or malformed requests", async () => {
  const encoder = new TextEncoder();
  const now = 1_800_000_000_000;
  const raw = '{"id":"evt_test"}';
  const secret = "whsec_fixture";
  const timestamp = now / 1000;
  const key = await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const signed = await crypto.subtle.sign("HMAC",key,encoder.encode(`${timestamp}.${raw}`));
  const hex = Array.from(new Uint8Array(signed), byte => byte.toString(16).padStart(2,"0")).join("");
  const header = `t=${timestamp},v1=${"0".repeat(64)},v1=${hex}`;
  assert.equal(await signedEvent(raw,header,secret,now),true);
  assert.equal(await signedEvent(raw + " ",header,secret,now),false);
  assert.equal(await signedEvent(raw,header,secret,now+301000),false);
  assert.equal(await signedEvent(raw,"t=invalid,v1=opaque",secret,now),false);
});
