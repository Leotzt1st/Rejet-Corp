import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowRight, FiBriefcase } from "react-icons/fi";

import styles from "./NegociacoesPage.module.css";

import { Avatar, Badge, EmptyState, Loader, Select } from "../../components/ui";
import { listNegotiations } from "../../services/negotiations/negotiationService";
import { useAuth } from "../../contexts/AuthContext";
import { formatCurrency, formatDateTime, formatQuantity } from "../../utils/format";
import { negotiationMaterialName, NEGOTIATION_STATUS_LABELS, type Negotiation, type NegotiationStatus } from "../../types/negotiation";

const STATUS_OPTIONS: { value: "" | NegotiationStatus; label: string }[] = [
  { value: "", label: "Todos os status" },
  { value: "interesse", label: "Interesse enviado" },
  { value: "em_negociacao", label: "Em negociação" },
  { value: "aceito", label: "Aceito" },
  { value: "recusado", label: "Recusado" },
  { value: "cancelado", label: "Cancelado" },
  { value: "finalizado", label: "Finalizado" },
];

const STATUS_VARIANT: Record<
  NegotiationStatus,
  "primary" | "secondary" | "success" | "danger" | "warning" | "neutral"
> = {
  interesse: "secondary",
  em_negociacao: "primary",
  aceito: "success",
  recusado: "danger",
  cancelado: "warning",
  finalizado: "neutral",
};

export default function NegociacoesPage() {
  const { profile, user } = useAuth();
  const currentUserId = profile?.id ?? user?.id ?? null;

  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [status, setStatus] = useState<"" | NegotiationStatus>("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const data = await listNegotiations(currentUserId);
      setNegotiations(data);
    } catch {
      setNegotiations([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = status
    ? negotiations.filter((negotiation) => negotiation.status === status)
    : negotiations;

  function counterpart(negotiation: Negotiation) {
    if (currentUserId && negotiation.buyer_id === currentUserId) {
      return negotiation.seller;
    }
    return negotiation.buyer;
  }

  function direction(negotiation: Negotiation) {
    if (currentUserId && negotiation.buyer_id === currentUserId) return "buyer";
    if (currentUserId && negotiation.seller_id === currentUserId) return "seller";
    return null;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Propostas e acordos</h2>
          <p className={styles.subtitle}>
            {negotiations.length} negociação{negotiations.length !== 1 ? "ões" : ""} encontrada
            {negotiations.length !== 1 ? "s" : ""}
          </p>
        </div>

        <Select
          name="status"
          value={status}
          onChange={(event) => setStatus(event.target.value as "" | NegotiationStatus)}
          options={STATUS_OPTIONS}
        />
      </div>

      {loading ? (
        <Loader text="Carregando negociações..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FiBriefcase aria-hidden="true" />}
          title="Nenhuma negociação"
          description="Quando sua empresa demonstrar interesse em um produto ou receber interesses, eles aparecerão aqui."
          action={
            <Link to="/marketplace" className={styles.linkBtn}>
              Explorar marketplace
            </Link>
          }
        />
      ) : (
        <div className={styles.list}>
          {filtered.map((negotiation) => {
            const other = counterpart(negotiation);
            const dir = direction(negotiation);
            const agreed = negotiation.status === "aceito" || negotiation.status === "finalizado";
            const quantity = agreed ? negotiation.accepted_quantity : negotiation.quantity;
            const unit = agreed ? negotiation.accepted_unit : negotiation.proposed_unit;
            const unitPrice = agreed ? negotiation.accepted_unit_price : negotiation.offered_price;
            return (
              <Link
                key={negotiation.id}
                to={`/negociacoes/${negotiation.id}`}
                className={styles.item}
              >
                <Avatar
                  src={other?.logo_url ?? null}
                  name={other?.company_name ?? "Empresa"}
                  size="lg"
                />

                <div className={styles.itemMain}>
                  <div className={styles.itemTop}>
                    <strong className={styles.otherName}>
                      {other?.company_name ?? "Empresa"}
                    </strong>
                    <Badge variant={STATUS_VARIANT[negotiation.status]}>
                      {NEGOTIATION_STATUS_LABELS[negotiation.status]}
                    </Badge>
                  </div>

                  <span className={styles.productName}>
                    {negotiationMaterialName(negotiation)}
                  </span>

                  <div className={styles.itemMeta}>
                    {quantity != null && <span>{formatQuantity(quantity, unit)}</span>}
                    <span>{formatCurrency(unitPrice)}</span>
                    <span>{formatDateTime(negotiation.updated_at)}</span>
                  </div>

                  <span className={styles.direction}>
                    {dir === "buyer"
                      ? "Você compra"
                      : dir === "seller"
                        ? "Você vende"
                        : "Interesse"}
                  </span>
                </div>

                <span className={styles.arrow}>
                  <FiArrowRight />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
