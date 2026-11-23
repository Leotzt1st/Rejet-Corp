import { supabase } from "../supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

export type FinanceView = "buyer" | "seller" | "admin";
export const PAYMENT = {
  pending: "Pendente", processing: "Processando", approved: "Aprovado", declined: "Recusado",
  cancelled: "Cancelado", expired: "Expirado", partially_refunded: "Parcialmente reembolsado",
  refunded: "Totalmente reembolsado", disputed: "Em contestação",
} as const;
export const ORDER = {
  awaiting_payment: "Aguardando pagamento", paid: "Pagamento confirmado", preparing: "Preparando material",
  shipped: "Enviado · aguardando recebimento", delivered: "Entregue", cancelled: "Cancelado", disputed: "Em disputa",
} as const;
export const REFUND = {
  requested: "Solicitado", reviewing: "Em análise", approved: "Aprovado para processamento", rejected: "Recusado",
  processing: "Processando no gateway", succeeded: "Concluído", failed: "Falhou", cancelled: "Cancelado",
} as const;
export const PAYOUT = { pending: "Pendente", in_transit: "Em trânsito", paid: "Pago", failed: "Falhou", canceled: "Cancelado" } as const;
export const METHOD: Record<string,string> = { pix: "Pix", card: "Cartão", boleto: "Boleto" };
export const REASONS: Record<string,string> = {
  not_received: "Material não recebido", not_as_described: "Material diferente do anunciado", quality: "Qualidade inadequada",
  damaged: "Material danificado", quantity: "Quantidade incorreta", duplicate_payment: "Pagamento duplicado",
  cancelled: "Pedido cancelado", other: "Outro motivo",
};

interface Party { id: string; company_name: string }
export interface FinanceOrder {
  id: string;
  negotiation_id: string;
  buyer_id: string;
  seller_id: string;
  buyer: Party | null;
  seller: Party | null;
  material: string;
  quantity: number;
  unit: string;
  amount_cents: number;
  commission_bps: number;
  commission_cents: number;
  refunded_cents: number;
  commission_reversed_cents: number | null;
  gateway_fee_cents: number | null;
  gateway_live: boolean | null;
  gateway_session: string | null;
  payment_method: string | null;
  payment_status: keyof typeof PAYMENT;
  order_status: keyof typeof ORDER;
  paid_at: string | null;
  received_at: string | null;
  refund_deadline_at: string | null;
  tracking: string | null;
  shipment_evidence: string | null;
  created_at: string;
}
export interface FinanceRefund {
  id: string;
  requested_by: string;
  amount_cents: number;
  reason: string;
  description: string;
  evidence_path: string | null;
  status: keyof typeof REFUND;
  decision: string | null;
  created_at: string;
}
export interface FinanceDispute { id: string; description: string; status: string; gateway_dispute: string | null; resolution: string | null; created_at: string }
export interface FinanceEvent { id: number; kind: string; created_at: string }
export interface FinancePayout {
  gateway_payout: string; seller_id: string; amount_cents: number; status: keyof typeof PAYOUT; gateway_live: boolean; arrival_at: string | null;
}
export interface FinanceSettings {
  enabled: boolean; commission_bps: number | null; methods: string[]; reverse_commission: boolean;
}
export interface FinanceQuote {
  material: string; quantity: number; unit: string; amount_cents: number; commission_bps: number; commission_cents: number;
}
export type FinanceQuoteResult = FinanceQuote | { order_id: string };

interface ListParams {
  view: FinanceView;
  actor: string;
  status: string;
  company: string;
  order: string;
  from: string;
  to: string;
  page: number;
}

const PAGE_SIZE = 20;
const selection = "*,buyer:companies!finance_orders_buyer_id_fkey(id,company_name),seller:companies!finance_orders_seller_id_fkey(id,company_name)";

export function message(e: unknown, fallback = "Não foi possível concluir a operação financeira.") {
  return typeof e === "object" && e !== null && "message" in e && typeof e.message === "string" ? e.message : fallback;
}

export function hundredths(value: string) {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const result = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(result) && result <= 99_999_999 ? result : null;
}

export async function financeCommand<T = Record<string, unknown>>(action: string, data: Record<string, unknown>): Promise<T> {
  const { data: result, error } = await supabase.rpc("finance_command", { p_action: action, p_data: data });
  if (error) throw error;
  return result as T;
}

export async function financeGateway<T = Record<string, unknown>>(action: string, data: Record<string, unknown>): Promise<T> {
  const { data: result, error } = await supabase.functions.invoke("finance", { body: { action, ...data } });
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null) as { error?: unknown } | null;
    if (typeof body?.error === "string") throw new Error(body.error);
  }
  if (error) throw new Error("Gateway indisponível. Verifique a configuração ou tente novamente.");
  return result as T;
}

export async function listFinanceOrders(p: ListParams) {
  let request = supabase.from("finance_orders").select(selection, { count: "exact" }).order("created_at", { ascending: false });
  if (p.view !== "admin") request = request.eq(p.view === "buyer" ? "buyer_id" : "seller_id", p.actor);
  if (p.status) request = request.eq("payment_status", p.status);
  if (p.order) request = request.eq("id", p.order);
  if (p.from) request = request.gte("created_at", `${p.from}T00:00:00Z`);
  if (p.to) request = request.lte("created_at", `${p.to}T23:59:59.999999Z`);
  if (p.view === "admin" && p.company) {
    const ids = await supabase.rpc("finance_find_companies", { p_query: p.company });
    if (ids.error) throw ids.error;
    if (!Array.isArray(ids.data) || !ids.data.length) return { items: [], pages: 1 };
    const joined = ids.data.join(",");
    request = request.or(`buyer_id.in.(${joined}),seller_id.in.(${joined})`);
  }
  const { data, count, error } = await request.range((p.page - 1) * PAGE_SIZE, p.page * PAGE_SIZE - 1);
  if (error) throw error;
  return { items: (data ?? []) as unknown as FinanceOrder[], pages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)) };
}

export async function financeSummary(view: FinanceView) {
  const { data, error } = await supabase.rpc("finance_summary", { p_view: view });
  if (error) throw error;
  return data as Record<string, number | null>;
}

export async function financeSettings() {
  const { data, error } = await supabase.from("finance_settings").select("*").single();
  if (error) throw error;
  return data as FinanceSettings;
}

export async function listFinancePayouts(view: FinanceView, actor: string) {
  let request = supabase.from("finance_payouts").select("*").order("observed_at", { ascending: false }).limit(20);
  if (view === "seller") request = request.eq("seller_id", actor);
  const { data, error } = await request;
  if (error) throw error;
  return (data ?? []) as FinancePayout[];
}

export async function getFinanceOrder(id: string) {
  const [order, refunds, disputes, events] = await Promise.all([
    supabase.from("finance_orders").select(selection).eq("id", id).single(),
    supabase.from("finance_refunds").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("finance_disputes").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("finance_events").select("id,kind,created_at").eq("order_id", id).order("id", { ascending: false }).limit(80),
  ]);
  for (const result of [order, refunds, disputes, events]) if (result.error) throw result.error;
  return { order: order.data as unknown as FinanceOrder, refunds: (refunds.data ?? []) as FinanceRefund[],
    disputes: (disputes.data ?? []) as FinanceDispute[], events: (events.data ?? []) as FinanceEvent[] };
}

export async function uploadEvidence(order: string, user: string, file: File) {
  const extensions: Record<string,string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" };
  const extension = extensions[file.type];
  if (!extension || file.size < 1 || file.size > 5 * 1024 * 1024) throw new Error("Use um PDF, JPG ou PNG de até 5 MB.");
  const path = `${order}/${user}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("finance-evidence").upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}

export async function evidenceDownload(path: string) {
  const { data, error } = await supabase.storage.from("finance-evidence").createSignedUrl(path, 60, { download: true });
  if (error) throw error;
  window.location.assign(data.signedUrl);
}
