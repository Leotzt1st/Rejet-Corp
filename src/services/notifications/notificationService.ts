import { supabase } from "../supabase/client";
import type { AppNotification, NotificationInput, NotificationType } from "../../types/notification";

export async function listNotifications(userId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

export async function getUnreadCount(userId: string) {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);

  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
  if (error) throw error;
}

export async function createNotification(input: NotificationInput) {
  const { error } = await supabase.from("notifications").insert(input);
  if (error) throw error;
}

export async function deleteNotification(id: string) {
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) throw error;
}

export function subscribeToNotifications(
  userId: string,
  onNotification: (notification: AppNotification) => void
) {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        onNotification(payload.new as unknown as AppNotification);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  interesse: "Novo interesse",
  mensagem: "Nova mensagem",
  negociacao: "Negociação",
  aviso: "Aviso",
  sistema: "Sistema",
};
