import type { Company } from "./company";
import type { Product } from "./product";

export interface Conversation {
  id: string;
  product_id: string | null;
  participant_a: string;
  participant_b: string;
  created_at: string;
  updated_at: string;
  product?: Product | null;
  other?: Company | null;
  last_message?: ChatMessage | null;
  unread_count?: number;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read: boolean;
  created_at: string;
  sender?: Pick<Company, "id" | "company_name" | "logo_url"> | null;
}

export interface ConversationInput {
  product_id: string;
  participant_b: string;
}
