import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiCheck, FiClock, FiMessageSquare, FiPackage, FiX } from "react-icons/fi";

import styles from "./NegociacaoDetailPage.module.css";
import { OrderCheckout } from "../../components/finance/OrderCheckout";

import {
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Card,
  ConfirmDialog,
  Loader,
} from "../../components/ui";
import {
  getNegotiation,
  listNegotiationHistory,
  updateNegotiationStatus,
} from "../../services/negotiations/negotiationService";
import { useMediaUrl } from "../../hooks/useMediaUrl";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../components/ui/Toast";
import { formatCurrency, formatDateTime, formatQuantity, timeAgo } from "../../utils/format";
import { negotiationMaterialName, NEGOTIATION_PAYMENT_LABELS, NEGOTIATION_STATUS_LABELS, type Negotiation, type NegotiationHistoryEntry, type NegotiationStatus } from "../../types/negotiation";

const STATUS_VARIANT: Record<string, "primary" | "secondary" | "success" | "danger" | "warning" | "neutral"> = {
  interesse: "secondary",
  em_negociacao: "primary",
  aceito: "success",
  recusado: "danger",
  cancelado: "warning",
  finalizado: "neutral",
};

const CLOSE_ACTIONS = {
  recusado: {
    title: "Recusar proposta?",
    message: "Esta proposta será encerrada como recusada.",
    label: "Recusar proposta",
  },
  cancelado: {
    title: "Cancelar negociação?",
    message: "A negociação será encerrada e a outra empresa verá o status de cancelamento.",
    label: "Cancelar negociação",
  },
};

export default function NegociacaoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile, user } = useAuth();
  const currentUserId = profile?.id ?? user?.id ?? null;
  const { success, error } = useToast();

  const [negotiation, setNegotiation] = useState<Negotiation | null>(null);
  const [history, setHistory] = useState<NegotiationHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [pendingClose, setPendingClose] = useState<{ id: string; status: keyof typeof CLOSE_ACTIONS } | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [data, historyData] = await Promise.all([
        getNegotiation(id),
        listNegotiationHistory(id).catch(() => []),
      ]);
      setNegotiation(data);
      setHistory(historyData);
    } catch {
      setNegotiation(null);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const agreed = Boolean(negotiation?.accepted_material) || negotiation?.status === "aceito" || negotiation?.status === "finalizado";
  const productImage = useMediaUrl(agreed ? undefined : negotiation?.product?.main_image);

  if (loading) {
    return <Loader text="Carregando negociação…" fullPage />;
  }

  if (!negotiation) {
    return (
      <div className={styles.notFound}>
        <h2>Negociação não encontrada</h2>
        <Button to="/negociacoes" variant="outline">
          Voltar para negociações
        </Button>
      </div>
    );
  }

  const isSeller = currentUserId != null && negotiation.seller_id === currentUserId;
  const isBuyer = currentUserId != null && negotiation.buyer_id === currentUserId;
  const other = isBuyer ? negotiation.seller : negotiation.buyer;
  const product = negotiation.product;
  const material = agreed ? negotiation.accepted_material : product;
  const materialName = negotiationMaterialName(negotiation);
  const quantity = agreed ? negotiation.accepted_quantity : negotiation.quantity;
  const unit = agreed ? negotiation.accepted_unit : negotiation.proposed_unit;
  const unitPrice = agreed ? negotiation.accepted_unit_price : negotiation.offered_price;
  const matchesListing = unit != null && unit === product?.unit;
  const estimatedQuantity = quantity ?? (matchesListing ? product?.quantities : null);
  const estimatedUnitPrice = unitPrice ?? (matchesListing ? product?.price : null);
  const estimate = estimatedQuantity != null && estimatedUnitPrice != null ? Number(estimatedQuantity) * Number(estimatedUnitPrice) : null;
  const agreedTotal = negotiation.accepted_total_cents == null ? null : Number(negotiation.accepted_total_cents) / 100;
  const total = agreed ? agreedTotal : estimate;

  const openProposal = negotiation.status === "interesse" || negotiation.status === "em_negociacao";
  const canRespond = isSeller && openProposal;
  const canFinalize = (isSeller || isBuyer) && negotiation.status === "aceito";
  const confirmedPayment = negotiation.confirmed_payment_method;
  const waitingForPayment = canFinalize && negotiation.payment_required !== false && !confirmedPayment;
  const showPayment = isBuyer && negotiation.status === "aceito";
  const canCancel = (isBuyer || isSeller) && openProposal;
  const requiresNewProposal = canCancel && !matchesListing;
  const canNegotiate = isSeller && negotiation.status === "interesse";
  const closeStatus = pendingClose?.id === id ? pendingClose?.status : undefined;
  const closeAction = closeStatus && CLOSE_ACTIONS[closeStatus];

  let nextStep: { title: string; detail: string } | undefined;
  if (requiresNewProposal) {
    nextStep = {
      title: "É preciso enviar uma nova proposta",
      detail: isBuyer
        ? "Abra o anúncio e confira a unidade atual antes de enviar outra proposta."
        : "Peça ao comprador uma nova proposta com a unidade atual do anúncio.",
    };
  } else if (canRespond) {
    nextStep = {
      title: "Responda à proposta",
      detail: "Revise quantidade e preço antes de aceitar ou recusar.",
    };
  } else if (isBuyer && canCancel) {
    nextStep = {
      title: "Aguardando resposta da empresa",
      detail: "A empresa que anunciou o material pode aceitar ou recusar sua proposta.",
    };
  } else if (waitingForPayment && isSeller) {
    nextStep = {
      title: "Aguardando forma de pagamento",
      detail: "O comprador precisa confirmar a escolha para liberar a finalização.",
    };
  } else if (canFinalize && !waitingForPayment) {
    nextStep = {
      title: "Combine os detalhes com a outra empresa",
      detail: isSeller && confirmedPayment
        ? `Forma confirmada pelo comprador: ${NEGOTIATION_PAYMENT_LABELS[confirmedPayment]}.`
        : "Finalize a negociação quando o acordo estiver concluído.",
    };
  }

  const changeStatus = async (next: NegotiationStatus) => {
    setUpdating(true);
    try {
      await updateNegotiationStatus(negotiation.id, next);
      setPendingClose(null);
      success("Status atualizado.");
      void refresh();
    } catch (err) {
      error(err instanceof Error ? err.message : "Falha ao atualizar status.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className={styles.page}>
      <Breadcrumb
        items={[
          { label: "Negociações", to: "/negociacoes" },
          { label: "Detalhes da negociação" },
        ]}
      />

      <div className={styles.layout}>
        <Card className={styles.mainCard}>
          <div className={styles.statusRow}>
            <Badge
              variant={STATUS_VARIANT[negotiation.status] ?? "neutral"}
            >
              {NEGOTIATION_STATUS_LABELS[negotiation.status]}
            </Badge>
            <span className={styles.date}>{formatDateTime(negotiation.updated_at)}</span>
          </div>

          {material && (
            <div className={styles.productRow}>
              <div className={styles.productImage}>
                {!agreed && productImage ? (
                  <img src={productImage} alt={materialName} />
                ) : (
                  <span className={styles.noImage}>
                    <FiPackage aria-hidden="true" />
                  </span>
                )}
              </div>

              <div className={styles.productInfo}>
                {product && !agreed
                  ? <Link to={`/produto/${product.id}`} className={styles.productTitle}>{materialName}</Link>
                  : <strong className={styles.productTitle}>{materialName}</strong>}
                <span className={styles.productMeta}>
                  {material.category ?? "Sem categoria"} · {material.condition ?? "—"}
                </span>
                {agreed && material.description && <span className={styles.productMeta}>{material.description}</span>}
                {!agreed && product && !requiresNewProposal && <strong className={styles.productPrice}>
                  {formatCurrency(product.price)}
                </strong>}
              </div>
            </div>
          )}

          <div className={styles.detailGrid}>
            <div className={styles.detailItem}>
              <span>Quantidade</span>
              <strong>{formatQuantity(quantity, unit)}</strong>
            </div>
            <div className={styles.detailItem}>
              <span>{agreed ? "Preço unitário acordado" : "Preço oferecido"}</span>
              <strong>{formatCurrency(unitPrice)}</strong>
            </div>
            {!showPayment && <div className={styles.detailItem}>
              <span>{agreed ? "Total acordado" : "Preço total estimado"}</span>
              <strong>{total !== null && Number.isFinite(total) ? formatCurrency(total) : "A confirmar"}</strong>
            </div>}
          </div>

          {negotiation.message && (
            <div className={styles.message}>
              <span className={styles.messageLabel}>Mensagem do interessado</span>
              <p>{negotiation.message}</p>
            </div>
          )}

          {showPayment && <OrderCheckout key={negotiation.id} negotiation={negotiation} onConfirmed={(method) => {
            setNegotiation((current) => current?.id === negotiation.id ? { ...current, confirmed_payment_method: method } : current);
          }} />}

          {nextStep && (
            <section className={styles.nextStep} aria-label="Próximo passo">
              <FiClock aria-hidden="true" />
              <div>
                <h2>{nextStep.title}</h2>
                <p>{nextStep.detail}</p>
                {requiresNewProposal && isBuyer && product && (
                  <Link to={`/produto/${product.id}`}>Abrir anúncio</Link>
                )}
                {waitingForPayment && isSeller && (
                  <Button type="button" size="sm" variant="outline" onClick={() => void refresh()}>
                    Verificar confirmação
                  </Button>
                )}
              </div>
            </section>
          )}

          {(canRespond || canFinalize || canCancel) && (
            <div className={styles.actions}>
              {canRespond && (
                <>
                  <Button onClick={() => changeStatus("aceito")} disabled={updating || requiresNewProposal}>
                    <FiCheck aria-hidden="true" /> Aceitar proposta
                  </Button>
                  <Button variant="danger" onClick={() => setPendingClose({ id: negotiation.id, status: "recusado" })} disabled={updating}>
                    <FiX aria-hidden="true" /> Recusar proposta
                  </Button>
                </>
              )}

              {canNegotiate && (
                <Button
                  variant="secondary"
                  onClick={() => changeStatus("em_negociacao")}
                  disabled={updating}
                >
                  <FiMessageSquare aria-hidden="true" /> Iniciar negociação
                </Button>
              )}

              {canFinalize && (
                <Button onClick={() => changeStatus("finalizado")} disabled={updating || waitingForPayment}>
                  <FiCheck aria-hidden="true" /> Finalizar negociação
                </Button>
              )}

              {canCancel && (
                <Button variant="danger" onClick={() => setPendingClose({ id: negotiation.id, status: "cancelado" })} disabled={updating}>
                  <FiX aria-hidden="true" /> Cancelar negociação
                </Button>
              )}
            </div>
          )}
        </Card>

        <div className={styles.sideColumn}>
          <Card className={styles.sideCard}>
            <h2 className={styles.sideTitle}>Outra parte</h2>
            <div className={styles.party}>
              <Avatar
                src={other?.logo_url ?? null}
                name={other?.company_name ?? "Empresa"}
                size="lg"
              />
              <div>
                <strong className={styles.partyName}>{other?.company_name ?? "Empresa"}</strong>
                <span className={styles.partyMeta}>
                  {[other?.city, other?.state].filter(Boolean).join(", ") || "Localização não informada"}
                </span>
                <div className={styles.partyBadge}>
                  <Badge variant={isSeller ? "secondary" : "success"}>
                    {isSeller ? "Comprador" : "Vendedor"}
                  </Badge>
                  {other?.verified && <Badge variant="success">Verificada</Badge>}
                </div>
              </div>
            </div>
          </Card>

          {history.length > 0 && (
            <Card title="Histórico" className={styles.sideCard}>
              <div className={styles.timeline}>
                {history.map((entry, index) => (
                  <div key={entry.id} className={styles.timelineItem}>
                    <div className={styles.timelineDot} />
                    {index < history.length - 1 && <div className={styles.timelineLine} />}
                    <div className={styles.timelineContent}>
                      <div className={styles.timelineHeader}>
                        <strong>{NEGOTIATION_STATUS_LABELS[entry.new_status as keyof typeof NEGOTIATION_STATUS_LABELS] ?? entry.new_status}</strong>
                        <span className={styles.timelineTime}>{timeAgo(entry.created_at)}</span>
                      </div>
                      {entry.actor && (
                        <span className={styles.timelineActor}>
                          por {entry.actor.company_name}
                        </span>
                      )}
                      {entry.observation && (
                        <span className={styles.timelineObs}>{entry.observation}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
      {closeAction && closeStatus && (
        <ConfirmDialog
          open
          title={closeAction.title}
          message={closeAction.message}
          confirmLabel={closeAction.label}
          cancelLabel="Voltar"
          loading={updating}
          onCancel={() => { if (!updating) setPendingClose(null); }}
          onConfirm={() => changeStatus(closeStatus)}
        />
      )}
    </div>
  );
}
