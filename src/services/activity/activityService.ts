import { supabase } from "../supabase/client";
import type { ActivityLog } from "../../types/activity";

export async function listActivities(limit = 100) {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("id,user_id,action,details,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as ActivityLog[];
}

export async function listUserActivities(userId: string, limit = 10) {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("id,user_id,action,details,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as ActivityLog[];
}

const ACTIVITY_LABELS: Record<string, string> = {
  product_created: "Produto cadastrado",
  product_updated: "Produto atualizado",
  favorite_added: "Favorito adicionado",
  negotiation_created: "Negociação iniciada",
  negotiation_accepted: "Negociação aceita",
  negotiation_refused: "Negociação recusada",
  negotiation_finished: "Negociação finalizada",
  negotiation_cancelled: "Negociação cancelada",
  message_sent: "Mensagem enviada",
  review_created: "Avaliação enviada",
  report_created: "Denúncia registrada",
};

export function getActivityLabel(action: string): string {
  return ACTIVITY_LABELS[action] ?? action.replace(/_/g, " ");
}
