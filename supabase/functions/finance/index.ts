import { cents, CHECKOUT_API_VERSION, checkoutForm, checkoutMethods, object, paymentState, providerId, refundForm, signedEvent, uuid, type Row } from "./stripe.ts";

class Failure extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function required(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Failure(503, "Financeiro ainda não configurado no servidor.");
  return value;
}

function billingMode() {
  const mode = Deno.env.get("BILLING_MODE");
  const key = required("STRIPE_SECRET_KEY");
  const live = mode === "live" && Deno.env.get("BILLING_LIVE_ENABLED") === "true";
  if ((!live && mode !== "test") || !key.startsWith(live ? "sk_live_" : "sk_test_")) {
    throw new Failure(503, "Gateway financeiro desabilitado para este ambiente.");
  }
  return { live, key };
}

function returnOrigin(live: boolean) {
  try {
    const url = new URL(required("BILLING_APP_ORIGIN"));
    const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
    if (url.username || url.password || (url.protocol !== "https:" && !(url.protocol === "http:" && !live && loopback))) {
      throw new Error("Not a trusted origin");
    }
    return url.origin;
  } catch {
    throw new Failure(503, "Configure a origem autorizada do checkout.");
  }
}

async function db(functionName: string, args: Row): Promise<unknown> {
  const key = required("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${required("SUPABASE_URL")}/rest/v1/rpc/${functionName}`, {
    method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(args), signal: AbortSignal.timeout(10000),
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    const error = object(value);
    if (error.code === "P0001" && typeof error.message === "string") throw new Failure(409, error.message);
    if (error.code === "42501") throw new Failure(403, "Operação sem permissão.");
    if (error.code === "23505") throw new Failure(409, "Esta operação financeira já foi registrada.");
    throw new Failure(502, "O banco não confirmou a operação financeira.");
  }
  return value;
}

async function actor(request: Request) {
  const token = request.headers.get("Authorization");
  if (!token?.startsWith("Bearer ")) throw new Failure(401, "Faça login para continuar.");
  const response = await fetch(`${required("SUPABASE_URL")}/auth/v1/user`, {
    headers: { apikey: required("SUPABASE_ANON_KEY"), Authorization: token },
    signal: AbortSignal.timeout(7000),
  });
  const user = object(await response.json());
  if (!response.ok || !uuid(user.id)) throw new Failure(401, "Sessão inválida.");
  // Claims are used only after Supabase Auth has validated this exact bearer token.
  const encodedClaims = token.slice(7).split(".")[1];
  let aal2 = false;
  if (encodedClaims) {
    try {
      const claims = object(JSON.parse(atob(encodedClaims.replace(/-/g, "+").replace(/_/g, "/"))));
      aal2 = claims.sub === user.id && claims.aal === "aal2";
    } catch { /* An unreadable claim cannot grant administrative access. */ }
  }
  return { id: user.id, aal2 };
}

async function stripe(path: string, options: { account?: string; body?: URLSearchParams; idem?: string; version?: string } = {}) {
  const { key } = billingMode();
  const headers = new Headers({ Authorization: `Bearer ${key}` });
  if (options.account) headers.set("Stripe-Account", options.account);
  if (options.idem) headers.set("Idempotency-Key", options.idem);
  const version = options.version ?? Deno.env.get("STRIPE_API_VERSION");
  if (version) headers.set("Stripe-Version", version);
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: options.body ? "POST" : "GET", headers, body: options.body, signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const code = object(object(await response.json().catch(() => null)).error).code;
    console.warn("finance.stripe_failed", { status: response.status, code: typeof code === "string" ? code : undefined });
    throw new Failure(502, "O gateway não confirmou a operação. Tente novamente ou solicite reconciliação.");
  }
  return object(await response.json());
}

function logged(p_kind: string, p_data: Row) {
  return db("finance_gateway_apply", { p_kind, p_data });
}

function prepare(p_actor: string, p_action: string, p_data: Row) {
  return db("finance_gateway_prepare", { p_actor, p_action, p_data });
}

function sessionData(session: Row, account: string, live: boolean, eventKey: string) {
  return {
    order_id: object(session.metadata).rejet_order, account, live, event_key: eventKey,
    session_id: providerId(session, "cs_"), payment_id: providerId(session.payment_intent, "pi_"),
    amount_cents: session.amount_total, currency: session.currency, status: session.status,
  };
}

async function checkout(user: string, data: Row, live: boolean) {
  if (!uuid(data.order_id)) throw new Failure(400, "Pedido inválido.");
  const origin = returnOrigin(live);
  let order = object(await prepare(user, "checkout", { order_id: data.order_id, live }));
  const account = providerId(order.gateway_account, "acct_");
  if (!account) throw new Failure(503, "Vendedor ainda não habilitado.");

  const stored = providerId(order.gateway_session, "cs_");
  let session: Row;
  if (stored) {
    session = await stripe(`checkout/sessions/${stored}`, { account, version: CHECKOUT_API_VERSION });
  } else {
    const seller = await stripe(`accounts/${account}`);
    const methods = checkoutMethods(order.gateway_methods, seller);
    if (!methods.length) throw new Failure(409, "Nenhum método de pagamento disponível nesta conta.");
    order = object(await prepare(user, "checkout_methods", { order_id: order.id, live, methods }));
    const frozen = Array.isArray(order.gateway_selected_methods) ? order.gateway_selected_methods as string[] : [];
    if (!frozen.length || frozen.some((method) => !methods.includes(method))) {
      throw new Failure(409, "Os métodos da tentativa mudaram. Solicite reconciliação.");
    }
    session = await stripe("checkout/sessions", {
      account, body: checkoutForm(order, frozen, origin), idem: `rejet-checkout-${order.id}`, version: CHECKOUT_API_VERSION,
    });
  }
  if (object(session.metadata).rejet_order !== order.id || session.livemode !== live || !providerId(session, "cs_")) {
    throw new Failure(502, "O checkout retornou dados incompatíveis.");
  }
  await logged("session", {
    ...sessionData(session, account, live, `session:${session.id}:${session.status}`),
    trusted_creation: !stored,
  });
  if (session.status !== "open") throw new Failure(409, "Esta sessão já encerrou. Consulte o pedido.");
  if (session.ui_mode === "form" && typeof session.client_secret === "string" && session.client_secret) {
    return { client_secret: session.client_secret, stripe_account: account, test: !live };
  }
  if (!stored || typeof session.url !== "string") throw new Failure(502, "A Stripe não disponibilizou o formulário de pagamento.");
  const target = new URL(session.url);
  if (target.protocol !== "https:" || target.hostname !== "checkout.stripe.com" || target.username || target.password) {
    throw new Failure(502, "O endereço de pagamento recebido não é válido.");
  }
  return { url: target.href, test: !live };
}

async function totals(charge: Row, account: string, appFee: string | null, includePending: boolean) {
  let refunded = 0;
  const refunds: Row[] = [];
  const chargeId = providerId(charge, "ch_");
  if (chargeId && (includePending || (typeof charge.amount_refunded === "number" && charge.amount_refunded > 0))) {
    let cursor = "";
    for (let page = 0; page < 100; page++) {
      const list = await stripe(`refunds?charge=${chargeId}&limit=100${cursor ? `&starting_after=${cursor}` : ""}`, { account });
      if (!Array.isArray(list.data)) throw new Failure(502, "Extrato de estornos inválido.");
      for (const raw of list.data) {
        const refund = object(raw);
        if (refund.status === "succeeded") refunded += cents(refund.amount);
        if (includePending) refunds.push(refund);
      }
      if (list.has_more === false) break;
      cursor = providerId(list.data.at(-1), "re_") ?? "";
      if (!cursor || page === 99) throw new Failure(502, "Não foi possível reconciliar todos os estornos.");
    }
  }
  const fee = object(charge.balance_transaction);
  const gatewayFee = Array.isArray(fee.fee_details)
    ? fee.fee_details.map(object).filter((item) => item.type !== "application_fee")
      .reduce((sum, item) => sum + cents(item.amount), 0)
    : null;
  const reversed = appFee ? (await stripe(`application_fees/${appFee}`)).amount_refunded : null;
  return { refunded_cents: refunded, fee_cents: gatewayFee, reversed_cents: reversed, refunds };
}

async function reconcilePayment(id: string, account: string, live: boolean, event: string, key: string, syncRefunds = false) {
  const intent = await stripe(`payment_intents/${id}?expand[]=latest_charge.balance_transaction`, { account });
  const order = object(intent.metadata).rejet_order;
  if (!uuid(order)) return null;
  if (intent.livemode !== live || intent.id !== id) throw new Failure(502, "Pagamento incompatível.");
  const status = paymentState(intent, event);
  const charge = object(intent.latest_charge);
  const appFee = providerId(charge.application_fee, "fee_");
  const payment = {
    order_id: order, account, live, payment_id: id, status, event_key: key,
    amount_cents: status === "approved" ? intent.amount_received : intent.amount,
    currency: intent.currency, method: object(charge.payment_method_details).type, fee_id: appFee,
    commission_cents: intent.application_fee_amount ?? 0,
  };
  await logged("payment", payment);
  if (status === "approved") {
    const { refunds, ...balance } = await totals(charge, account, appFee, syncRefunds);
    await logged("payment", { ...payment, ...balance, event_key: `${key}:balance` });
    for (const refund of refunds) await applyRefund(refund, account, live, key, order, id);
  }
  return order;
}

function applyRefund(refund: Row, account: string, live: boolean, key: string, order: string, payment: string) {
  const metadata = object(refund.metadata);
  const id = providerId(refund, "re_");
  if (!id || metadata.rejet_order !== order || !uuid(metadata.rejet_refund)) return;
  return logged("refund", {
    order_id: order, refund_id: metadata.rejet_refund, payment_id: payment, account, live,
    provider_refund: id, amount_cents: refund.amount, currency: refund.currency,
    status: refund.status, event_key: `${key}:${id}:${refund.status}`,
  });
}

async function recordRefund(refund: Row, account: string, live: boolean, eventKey: string) {
  const metadata = object(refund.metadata);
  const payment = providerId(refund.payment_intent, "pi_");
  const refundId = providerId(refund, "re_");
  if (payment && refundId && uuid(metadata.rejet_order) && uuid(metadata.rejet_refund)) {
    const currentOrder = await reconcilePayment(payment, account, live, "refund.updated", `${eventKey}:payment`);
    if (currentOrder !== metadata.rejet_order) throw new Failure(502, "Estorno incompatível.");
    await applyRefund(refund, account, live, eventKey, metadata.rejet_order, payment);
  } else if (payment) {
    await reconcilePayment(payment, account, live, "refund.updated", `${eventKey}:payment`);
  }
}

async function processRefund(user: string, data: Row, live: boolean, aal2: boolean) {
  if (!uuid(data.order_id) || !uuid(data.refund_id)) throw new Failure(400, "Solicitação inválida.");
  const result = object(await prepare(user, "refund", { order_id: data.order_id, refund_id: data.refund_id, live, admin_aal2: aal2 }));
  const order = object(result.order);
  const refund = object(result.refund);
  const account = providerId(order.gateway_account, "acct_");
  if (!account) throw new Failure(409, "Conta de estorno indisponível.");
  const existing = providerId(refund.gateway_refund, "re_");
  const state = existing
    ? await stripe(`refunds/${existing}`, { account })
    : await stripe("refunds", { account, body: refundForm(order, refund), idem: `rejet-refund-${refund.id}` });
  if (object(state.metadata).rejet_refund !== refund.id || object(state.metadata).rejet_order !== order.id) {
    throw new Failure(502, "O estorno retornou dados incompatíveis.");
  }
  await recordRefund(state, account, live, `refund:${state.id}:${state.status}`);
  return { received: true };
}

async function webhook(request: Request, raw: string, live: boolean) {
  if (!await signedEvent(raw, request.headers.get("Stripe-Signature") ?? "", required("STRIPE_WEBHOOK_SECRET"))) {
    throw new Failure(400, "Assinatura inválida.");
  }
  const event = object(JSON.parse(raw));
  const key = providerId(event, "evt_");
  const account = providerId(event.account, "acct_");
  const kind = typeof event.type === "string" ? event.type : "";
  if (!key || event.livemode !== live) throw new Failure(400, "Evento incompatível com o ambiente.");
  const value = object(object(event.data).object);
  if (!account) return { received: true };

  if (["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"].includes(kind)) {
    const id = providerId(value, "cs_");
    if (id) {
      const session = await stripe(`checkout/sessions/${id}`, { account });
      if (uuid(object(session.metadata).rejet_order)) {
        await logged("session", sessionData(session, account, live, `${key}:session`));
        const payment = providerId(session.payment_intent, "pi_");
        if (payment) await reconcilePayment(payment, account, live, kind, `${key}:payment`);
      }
    }
  } else if (["payment_intent.succeeded", "payment_intent.processing", "payment_intent.payment_failed", "payment_intent.canceled", "charge.refunded", "charge.updated"].includes(kind)) {
    const id = providerId(kind.startsWith("charge.") ? value.payment_intent : value, "pi_");
    if (id) await reconcilePayment(id, account, live, kind, `${key}:payment`);
  } else if (["refund.created", "refund.updated", "refund.failed", "charge.refund.updated"].includes(kind)) {
    const id = providerId(value, "re_");
    if (id) await recordRefund(await stripe(`refunds/${id}`, { account }), account, live, key);
  } else if (kind.startsWith("charge.dispute.")) {
    const id = providerId(value, "dp_");
    if (id) {
      const dispute = await stripe(`disputes/${id}`, { account });
      const payment = providerId(dispute.payment_intent, "pi_");
      if (payment) {
        const order = await reconcilePayment(payment, account, live, kind, `${key}:payment`);
        const status = dispute.status === "won" || dispute.status === "lost" ? dispute.status
          : dispute.status === "warning_closed" || dispute.status === "prevented" ? "closed" : "open";
        if (order) await logged("dispute", { order_id: order, live, account, status,
          payment_id: payment, dispute_id: id, event_key: `${key}:dispute` });
      }
    }
  } else if (kind.startsWith("payout.")) {
    const id = providerId(value, "po_");
    if (id) {
      const payout = await stripe(`payouts/${id}`, { account });
      if (payout.currency === "brl" && cents(payout.amount) > 0) await logged("payout", {
        live, account, payout_id: id, event_key: `${key}:payout`, status: payout.status,
        currency: payout.currency, amount_cents: payout.amount, arrival_at: payout.arrival_date, observed_at: event.created,
      });
    }
  }
  return { received: true };
}

async function readText(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let bytes = 0;
  let payload = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return payload + decoder.decode();
      bytes += value.byteLength;
      if (bytes > 512 * 1024) throw new Failure(413, "Corpo da solicitação muito grande.");
      payload += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store", Vary: "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "OPTIONS, POST",
  });
  function respond(value: unknown, status = 200) {
    if (origin && origin === Deno.env.get("BILLING_APP_ORIGIN")) headers.set("Access-Control-Allow-Origin", origin);
    return new Response(JSON.stringify(value), { status, headers });
  }
  if (request.method === "OPTIONS") return respond({});
  if (request.method !== "POST") return respond({ error: "Método inválido." }, 405);
  const endpoint = new URL(request.url).pathname.split("/").at(-1);
  try {
    if (endpoint === "deadlines") {
      if (request.headers.get("Authorization") !== `Bearer ${required("BILLING_CRON_SECRET")}`) throw new Failure(403, "Acesso negado.");
      return respond({ notified: await db("finance_due_refunds", {}) });
    }
    const { live } = billingMode();
    if (endpoint === "webhook") return respond(await webhook(request, await readText(request), live));

    if (origin && origin !== returnOrigin(live)) throw new Failure(403, "Origem não autorizada.");
    const { id: user, aal2 } = await actor(request);
    const data = object(JSON.parse(await readText(request)));
    if ((data.action === "refund" || data.action === "link_seller") && !aal2) {
      throw new Failure(403, "Confirme a autenticação em dois fatores.");
    }
    if (data.action === "checkout") return respond(await checkout(user, data, live));
    if (data.action === "refund") return respond(await processRefund(user, data, live, aal2));
    if (data.action === "link_seller") {
      const account = providerId(data.account_id, "acct_");
      if (!account || !uuid(data.company_id)) throw new Failure(400, "Conta ou empresa inválida.");
      await prepare(user, "verify_admin", { live, admin_aal2: aal2 });
      const verified = await stripe(`accounts/${account}`);
      if (verified.id !== account || verified.country !== "BR") throw new Failure(409, "Conta conectada brasileira não localizada.");
      return respond(await prepare(user, "link_seller", { live, company_id: data.company_id, account_id: account, admin_aal2: aal2 }));
    }
    if (data.action === "reconcile") {
      if (!uuid(data.order_id)) throw new Failure(400, "Pedido inválido.");
      const o = object(await prepare(user, "reconcile", { live, order_id: data.order_id, admin_aal2: aal2 }));
      const account = providerId(o.gateway_account, "acct_");
      const payment = providerId(o.gateway_payment, "pi_");
      const sessionId = providerId(o.gateway_session, "cs_");
      if (!account || (!payment && !sessionId)) throw new Failure(409, "Pedido sem referência de pagamento.");
      const key = `reconcile:${o.id}:${crypto.randomUUID()}`;
      let target = payment;
      if (sessionId) {
        const session = await stripe(`checkout/sessions/${sessionId}`, { account });
        await logged("session", sessionData(session, account, live, `${key}:session`));
        target ??= providerId(session.payment_intent, "pi_");
      }
      if (target) await reconcilePayment(target, account, live, "", `${key}:payment`, true);
      return respond({ received: true });
    }
    return respond({ error: "Ação financeira inválida." }, 400);
  } catch (error) {
    if (error instanceof Failure) {
      if (endpoint === "webhook" && error.status !== 400) {
        console.warn("finance.webhook_retry", { status: error.status });
        return respond({ error: "Evento aguardando reconciliação." }, 503);
      }
      return respond({ error: error.message }, error.status);
    }
    if (error instanceof SyntaxError) return respond({ error: "JSON inválido." }, 400);
    console.warn("finance.request_failed", { route: endpoint === "webhook" ? "webhook" : "api", type: error instanceof Error ? error.name : "unknown" });
    return respond({ error: "Não foi possível confirmar a operação financeira." }, 502);
  }
});
