import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FiArrowLeft, FiMessageSquare, FiSend } from "react-icons/fi";

import styles from "./ChatPage.module.css";

import { Avatar, EmptyState, Loader } from "../../components/ui";
import { useToast } from "../../components/ui/Toast";
import { supabase } from "../../services/supabase/client";
import {
  listConversations,
  listMessages,
  markConversationRead,
  sendMessage,
  subscribeToConversation,
} from "../../services/messages/messageService";
import { useMediaUrl } from "../../hooks/useMediaUrl";
import { useAuth } from "../../contexts/AuthContext";
import { formatDateTime } from "../../utils/format";
import type { Conversation, ChatMessage } from "../../types/chat";

export default function ChatPage() {
  const { profile, user } = useAuth();
  const { error } = useToast();
  const currentUserId = profile?.id ?? user?.id ?? null;
  const [searchParams, setSearchParams] = useSearchParams();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});

  const listRef = useRef<HTMLDivElement>(null);

  const refreshConversations = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const data = await listConversations(currentUserId);
      setConversations(data);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    if (!currentUserId || conversations.length === 0) return;
    let cancelled = false;
    (async () => {
      const counts: Record<string, number> = {};
      await Promise.all(
        conversations.map(async (conv) => {
          const { count } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", conv.id)
            .eq("read", false)
            .neq("sender_id", currentUserId);
          if (!cancelled) counts[conv.id] = count ?? 0;
        })
      );
      if (!cancelled) setUnreadMap(counts);
    })();
    return () => { cancelled = true; };
  }, [conversations, currentUserId]);

  const openConversation = useCallback(
    async (conversationId: string) => {
      setActiveId(conversationId);
      setThreadLoading(true);
      try {
        const [data] = await Promise.all([
          listMessages(conversationId),
          currentUserId ? markConversationRead(conversationId, currentUserId) : undefined,
        ]);
        setMessages(data);
      } catch {
        setMessages([]);
      } finally {
        setThreadLoading(false);
      }
    },
    [currentUserId]
  );

  useEffect(() => {
    const param = searchParams.get("conversa");
    if (!param) return;
    setSearchParams({}, { replace: true });
    void openConversation(param);
  }, [openConversation, searchParams, setSearchParams]);

  useEffect(() => {
    if (!activeId || !currentUserId) return;
    const unsubscribe = subscribeToConversation(activeId, (message) => {
      setMessages((current) =>
        current.some((item) => item.id === message.id)
          ? current
          : [...current, message]
      );
      void refreshConversations();
    });
    return unsubscribe;
  }, [activeId, currentUserId, refreshConversations]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, activeId]);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    if (sending || !draft.trim() || !activeId || !currentUserId) return;

    setSending(true);
    try {
      await sendMessage(activeId, currentUserId, draft.trim());
      setDraft("");
      void openConversation(activeId);
      void refreshConversations();
    } catch (err) {
      error(err instanceof Error ? err.message : "Falha ao enviar a mensagem.");
    } finally {
      setSending(false);
    }
  }

  const active = conversations.find((conversation) => conversation.id === activeId) ?? null;
  const activeProductImage = useMediaUrl(active?.product?.main_image);

  return (
    <div className={styles.page}>
      <aside className={`${styles.list} ${activeId ? styles.listHidden : ""}`}>
        <div className={styles.listHeader}>
          <h2 className={styles.title}>Conversas</h2>
        </div>

        {loading ? (
          <Loader text="Carregando conversas…" />
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={<FiMessageSquare aria-hidden="true" />}
            title="Nenhuma conversa"
            description="Envie um interesse em um produto para iniciar uma conversa."
            action={
              <Link to="/marketplace" className={styles.linkBtn}>
                Explorar marketplace
              </Link>
            }
          />
        ) : (
          <div className={styles.convList}>
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className={`${styles.convItem} ${conversation.id === activeId ? styles.convActive : ""}`}
                onClick={() => openConversation(conversation.id)}
                aria-current={conversation.id === activeId ? "true" : undefined}
              >
                <Avatar
                  src={conversation.other?.logo_url ?? null}
                  name={conversation.other?.company_name ?? "Empresa"}
                  size="md"
                />
                <div className={styles.convBody}>
                  <div className={styles.convTop}>
                    <strong className={styles.convName}>
                      {conversation.other?.company_name ?? "Empresa"}
                    </strong>
                    <span className={styles.convTime}>
                      {conversation.last_message?.created_at
                        ? formatDateTime(conversation.last_message.created_at)
                        : ""}
                    </span>
                  </div>
                  <span className={styles.convProduct}>
                    {conversation.product?.product ?? "Conversa"}
                  </span>
                  <span className={styles.convLast}>
                    {conversation.last_message?.content ?? "Sem mensagens ainda"}
                  </span>
                </div>
                {unreadMap[conversation.id] != null && unreadMap[conversation.id] > 0 && (
                  <span className={styles.unreadBadge}>
                    {unreadMap[conversation.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </aside>

      <section className={`${styles.thread} ${activeId ? "" : styles.threadEmpty}`}>
        {!active ? (
          <div className={styles.placeholder}>
            <span className={styles.placeholderIcon}><FiMessageSquare aria-hidden="true" /></span>
            <p>Selecione uma conversa para começar.</p>
          </div>
        ) : (
          <>
            <div className={styles.threadHeader}>
              <button
                type="button"
                className={styles.backBtn}
                onClick={() => setActiveId(null)}
                aria-label="Voltar para as conversas"
              >
                <FiArrowLeft aria-hidden="true" />
              </button>

              <Avatar
                src={active.other?.logo_url ?? null}
                name={active.other?.company_name ?? "Empresa"}
                size="sm"
              />

              <div className={styles.threadWho}>
                <strong>{active.other?.company_name ?? "Empresa"}</strong>
                {active.product && (
                  <span>
                    Sobre: {active.product.product}
                    {activeProductImage && (
                      <img src={activeProductImage} alt="" width={20} height={20} className={styles.threadThumb} />
                    )}
                  </span>
                )}
              </div>
            </div>

            <div className={styles.messages} ref={listRef} role="log" aria-label="Histórico de mensagens">
              {threadLoading ? (
                <Loader text="Carregando mensagens…" small />
              ) : messages.length === 0 ? (
                <p className={styles.noMessages}>
                  Nenhuma mensagem ainda. Envie a primeira!
                </p>
              ) : (
                messages.map((message) => {
                  const mine = currentUserId != null && message.sender_id === currentUserId;
                  return (
                    <div
                      key={message.id}
                      className={`${styles.msgRow} ${mine ? styles.mine : styles.theirs}`}
                    >
                      <div className={styles.bubble}>
                        <p>{message.content}</p>
                        <span className={styles.msgTime}>
                          {formatDateTime(message.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form className={styles.composer} onSubmit={handleSend}>
              <input
                type="text"
                name="message"
                autoComplete="off"
                placeholder="Escreva uma mensagem…"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={4000}
                aria-label="Mensagem"
              />
              <button type="submit" disabled={sending || !draft.trim()} aria-label="Enviar">
                <FiSend aria-hidden="true" />
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
