import { supabase } from "../supabase/client";
import type { Conversation, ChatMessage, ConversationInput } from "../../types/chat";

const COMPANY_PICK = "id,company_name,trade_name,logo_url,city,state,verified,rating";

export async function listConversations(userId: string) {
  const { data, error } = await supabase
    .from("conversations")
    .select(
      `id,product_id,participant_a,participant_b,created_at,updated_at,
       participant_a:companies!conversations_participant_a_fkey(${COMPANY_PICK}),
       participant_b:companies!conversations_participant_b_fkey(${COMPANY_PICK}),
       product:produtos(id,product,main_image,price,images),
       last_message:messages(id,content,created_at,read,sender_id)`
    )
    .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;

  const conversations = rows.map((row) => {
    const a = row.participant_a as unknown as Conversation["other"];
    const b = row.participant_b as unknown as Conversation["other"];
    const other = a && a.id !== userId ? a : b;

    const lastArray = row.last_message as Array<Record<string, unknown>>;
    const last = Array.isArray(lastArray)
      ? (lastArray[lastArray.length - 1] as unknown as ChatMessage)
      : null;

    return {
      id: row.id as string,
      product_id: (row.product_id as string | null) ?? null,
      participant_a: row.participant_a as string,
      participant_b: row.participant_b as string,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      other: (other as Conversation["other"]) ?? null,
      product: (row.product as Conversation["product"]) ?? null,
      last_message: last,
    } as Conversation;
  });

  return conversations;
}

export async function getOrCreateConversation(
  userId: string,
  input: ConversationInput
) {
  const { product_id, participant_b } = input;
  const [a, b] = [userId, participant_b].sort();

  const findExisting = () => supabase
    .from("conversations")
    .select("id")
    .eq("product_id", product_id)
    .or(`and(participant_a.eq.${a},participant_b.eq.${b}),and(participant_a.eq.${b},participant_b.eq.${a})`)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const existing = await findExisting();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data.id as string;

  const { data, error } = await supabase
    .from("conversations")
    .insert({ participant_a: a, participant_b: b, product_id })
    .select("id")
    .single();

  if (error?.code === "23505") {
    const concurrent = await findExisting();
    if (concurrent.data) return concurrent.data.id as string;
  }
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function getConversation(id: string) {
  const { data, error } = await supabase
    .from("conversations")
    .select(
      `id,product_id,participant_a,participant_b,created_at,updated_at,
       participant_a:companies!conversations_participant_a_fkey(${COMPANY_PICK}),
       participant_b:companies!conversations_participant_b_fkey(${COMPANY_PICK}),
       product:produtos(id,product,main_image,price,images)`
    )
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as unknown as Conversation;
}

export async function listMessages(conversationId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select(`id,conversation_id,sender_id,content,read,created_at`)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ChatMessage[];
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string
) {
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, content })
    .select()
    .single();

  if (error) throw new Error(error.message);

  return data as ChatMessage;
}

export async function markConversationRead(conversationId: string, userId: string) {
  const { data } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("read", false)
    .neq("sender_id", userId);

  const ids = (data ?? []).map((m) => m.id);
  if (ids.length === 0) return;

  await supabase.from("messages").update({ read: true }).in("id", ids);
}

export function subscribeToConversation(
  conversationId: string,
  onMessage: (message: ChatMessage) => void
) {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        onMessage(payload.new as unknown as ChatMessage);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
