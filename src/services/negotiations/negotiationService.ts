import { supabase } from "../supabase/client";
import { readAllRows } from "../supabase/readAllRows";
import type {
  Negotiation,
  NegotiationHistoryEntry,
  NegotiationInput,
  NegotiationPaymentMethod,
  NegotiationStats,
  NegotiationStatus,
} from "../../types/negotiation";

const NEGOTIATION_BASE_SELECT = `id,product_id,buyer_id,seller_id,status,quantity,offered_price,message,created_at,updated_at,
buyer:companies!negotiations_buyer_id_fkey(id,company_name,trade_name,logo_url,city,state,verified,rating),
seller:companies!negotiations_seller_id_fkey(id,company_name,trade_name,logo_url,city,state,verified,rating),
product:produtos(id,product,description,price,is_free,main_image,images,city,state,condition,quantities,unit)`;

const REPORT_FIELD_GROUPS = [
  ["proposed_unit"],
  ["accepted_quantity", "accepted_unit_price", "accepted_unit", "accepted_total_cents"],
  ["accepted_material"],
];
const NEGOTIATION_SELECT = [NEGOTIATION_BASE_SELECT, ...REPORT_FIELD_GROUPS.flat()].join(",");

export async function createNegotiation(userId: string, input: NegotiationInput) {
  const product = await supabase
    .from("produtos")
    .select("id,created_by")
    .eq("id", input.product_id)
    .single();

  if (product.error) throw product.error;
  if (!product.data || product.data.created_by === userId) {
    throw new Error("Você não pode negociar este produto.");
  }

  const { data, error } = await supabase
    .from("negotiations")
    .insert({
      product_id: input.product_id,
      buyer_id: userId,
      seller_id: product.data.created_by,
      status: "interesse",
      proposed_unit: input.proposed_unit,
      quantity: input.quantity ?? null,
      offered_price: input.offered_price ?? null,
      message: input.message ?? null,
    })
    .select(NEGOTIATION_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as Negotiation;
}

export async function listNegotiations(userId: string) {
  return readNegotiations(userId, NEGOTIATION_SELECT);
}

async function readNegotiations(userId: string, fields: string) {
  const rows = await readAllRows((from, to) => supabase
    .from("negotiations")
    .select(fields, from === 0 ? { count: "exact" } : undefined)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order("updated_at", { ascending: false })
    .order("id")
    .range(from, to));
  return rows as unknown as Negotiation[];
}

export async function listNegotiationsForReporting(userId: string) {
  let fieldGroups = REPORT_FIELD_GROUPS;
  while (true) {
    try {
      const fields = [NEGOTIATION_BASE_SELECT, ...fieldGroups.flat()].join(",");
      return await readNegotiations(userId, fields);
    } catch (error) {
      const missing = missingReportingColumn(error);
      const remaining = fieldGroups.filter((fields) => !fields.includes(missing));
      if (remaining.length === fieldGroups.length) throw error;
      fieldGroups = remaining;
    }
  }
}

function missingReportingColumn(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "42703") return "";
  if (!("message" in error) || typeof error.message !== "string") return "";
  return error.message.match(/^column negotiations\.([a-z_]+) does not exist$/)?.[1] ?? "";
}

export async function getNegotiation(id: string) {
  const { data, error } = await supabase
    .from("negotiations")
    .select(`${NEGOTIATION_SELECT},confirmed_payment_method,payment_required`)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as unknown as Negotiation;
}

export async function confirmNegotiationPayment(id: string, method: NegotiationPaymentMethod) {
  const { data, error } = await supabase
    .from("negotiations")
    .update({ confirmed_payment_method: method })
    .eq("id", id)
    .eq("status", "aceito")
    .is("confirmed_payment_method", null)
    .select("confirmed_payment_method")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("A negociação mudou. Atualize a página antes de confirmar.");
}

export async function updateNegotiationStatus(id: string, status: NegotiationStatus) {
  const { data, error } = await supabase
    .from("negotiations")
    .update({ status })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Negociação indisponível. Atualize a página.");
}

export function summarizeNegotiations(items: Negotiation[], companyId: string): NegotiationStats {
  const byStatus: Record<NegotiationStatus, number> = {
    interesse: 0,
    em_negociacao: 0,
    aceito: 0,
    recusado: 0,
    cancelado: 0,
    finalizado: 0,
  };

  items.forEach((n) => {
    byStatus[n.status] = (byStatus[n.status] ?? 0) + 1;
  });

  const agreed = items.filter((n) => n.status === "finalizado" || n.status === "aceito");
  const totalValue = agreed.some((n) => n.accepted_total_cents == null)
    ? null
    : agreed.reduce((sum, n) => sum + Number(n.accepted_total_cents), 0) / 100;

  return {
    total: items.length,
    byStatus,
    totalValue,
    completed: byStatus.finalizado,
    sales: items.filter((item) => item.status === "finalizado" && item.seller_id === companyId).length,
    purchases: items.filter((item) => item.status === "finalizado" && item.buyer_id === companyId).length,
  };
}

const HISTORY_SELECT = `id,negotiation_id,actor_id,previous_status,new_status,observation,created_at,
actor:companies!negotiation_history_actor_id_fkey(id,company_name,logo_url)`;

export async function listNegotiationHistory(negotiationId: string) {
  const { data, error } = await supabase
    .from("negotiation_history")
    .select(HISTORY_SELECT)
    .eq("negotiation_id", negotiationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as NegotiationHistoryEntry[];
}
