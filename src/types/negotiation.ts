import type { Company } from "./company";
import type { Product } from "./product";

export type NegotiationStatus =
  | "interesse"
  | "em_negociacao"
  | "aceito"
  | "recusado"
  | "cancelado"
  | "finalizado";

export const NEGOTIATION_STATUS_LABELS: Record<NegotiationStatus, string> = {
  interesse: "Interesse enviado",
  em_negociacao: "Em negociação",
  aceito: "Aceito",
  recusado: "Recusado",
  cancelado: "Cancelado",
  finalizado: "Finalizado",
};

export const NEGOTIATION_PAYMENT_LABELS = { pix: "Pix", card: "Cartão de crédito", boleto: "Boleto bancário" };
export type NegotiationPaymentMethod = keyof typeof NEGOTIATION_PAYMENT_LABELS;

export interface Negotiation {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  status: NegotiationStatus;
  quantity: number | null;
  offered_price: number | null;
  proposed_unit?: string | null;
  confirmed_payment_method?: NegotiationPaymentMethod | null;
  payment_required?: boolean;
  accepted_quantity?: number | null;
  accepted_unit_price?: number | null;
  accepted_unit?: string | null;
  accepted_total_cents?: number | null;
  accepted_material?: { name: string; description: string | null; category: string | null; condition: string | null; type: string | null } | null;
  message: string | null;
  created_at: string;
  updated_at: string;
  product?: Product | null;
  buyer?: Company | null;
  seller?: Company | null;
}

export function negotiationMaterialName(negotiation: Negotiation) {
  if (negotiation.accepted_material?.name) return negotiation.accepted_material.name;
  if (negotiation.status === "aceito" || negotiation.status === "finalizado") {
    return "Material indisponível";
  }
  return negotiation.product?.product ?? "Material indisponível";
}

export function negotiationReportTerms(negotiation: Negotiation) {
  if (negotiation.status === "aceito" || negotiation.status === "finalizado") {
    return {
      quantity: negotiation.accepted_quantity,
      unit: negotiation.accepted_unit,
      unitPrice: negotiation.accepted_unit_price,
    };
  }
  return { quantity: negotiation.quantity, unit: negotiation.proposed_unit, unitPrice: negotiation.offered_price };
}

export interface NegotiationInput {
  product_id: string;
  proposed_unit: string;
  quantity?: number;
  offered_price?: number;
  message?: string;
}

export interface NegotiationStats {
  total: number;
  byStatus: Record<NegotiationStatus, number>;
  totalValue: number | null;
  completed: number;
  sales: number;
  purchases: number;
}

export interface NegotiationHistoryEntry {
  id: string;
  negotiation_id: string;
  actor_id: string | null;
  previous_status: string | null;
  new_status: string;
  observation: string | null;
  created_at: string;
  actor?: Pick<Company, "id" | "company_name" | "logo_url"> | null;
}
