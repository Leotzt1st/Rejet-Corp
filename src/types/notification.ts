export type NotificationType =
  | "interesse"
  | "mensagem"
  | "negociacao"
  | "aviso"
  | "sistema";

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface NotificationInput {
  user_id: string;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
}

export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  interesse: "💡",
  mensagem: "💬",
  negociacao: "🤝",
  aviso: "⚠️",
  sistema: "🔔",
};
