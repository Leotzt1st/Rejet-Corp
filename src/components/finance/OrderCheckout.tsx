import { useId, useRef, useState, type FormEvent } from "react";
import { FaPix } from "react-icons/fa6";
import { FiCreditCard, FiFileText } from "react-icons/fi";
import { NEGOTIATION_PAYMENT_LABELS, type Negotiation, type NegotiationPaymentMethod } from "../../types/negotiation";
import { confirmNegotiationPayment } from "../../services/negotiations/negotiationService";
import { Button } from "../ui";
import { formatCurrency } from "../../utils/format";
import styles from "./OrderCheckout.module.css";

const METHODS = [
  { value: "pix", description: "QR Code ou Pix Copia e Cola", icon: FaPix },
  { value: "card", description: "Autorização pela operadora do cartão", icon: FiCreditCard },
  { value: "boleto", description: "Pagamento por código de barras", icon: FiFileText },
] as const;

export function OrderCheckout({ negotiation, onConfirmed }: {
  negotiation: Negotiation;
  onConfirmed: (method: NegotiationPaymentMethod) => void;
}) {
  const id = useId();
  const feedback = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const confirmed = negotiation.confirmed_payment_method;
  const requiresPayment = negotiation.payment_required !== false;
  const total = negotiation.accepted_total_cents == null ? null : Number(negotiation.accepted_total_cents) / 100;
  const hasTotal = total !== null && Number.isFinite(total) && total > 0;

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const choice = new FormData(event.currentTarget).get("payment-method");
    const method = METHODS.find(({ value }) => value === choice)?.value;
    if (!method) return;

    setSaving(true);
    setError("");
    try {
      await confirmNegotiationPayment(negotiation.id, method);
      onConfirmed(method);
      requestAnimationFrame(() => feedback.current?.focus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível confirmar a forma de pagamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.payment} aria-labelledby={`${id}-title`}>
      <header className={styles.header}>
        <div>
          <h2 id={`${id}-title`}>Pagamento</h2>
          <p id={`${id}-availability`}>
            {requiresPayment ? "A confirmação registra sua escolha. A cobrança pelo site ainda não está disponível." : "Este material é gratuito."}
          </p>
        </div>
        {requiresPayment && (
          <dl className={styles.total}>
            <dt>Total acordado</dt>
            <dd>{hasTotal ? formatCurrency(total) : "A confirmar"}</dd>
          </dl>
        )}
      </header>

      <div ref={feedback} className={styles.feedback} role="status" tabIndex={-1}>
        {confirmed && <strong>Forma confirmada: {NEGOTIATION_PAYMENT_LABELS[confirmed]}</strong>}
      </div>
      {requiresPayment && !confirmed && (
        <form className={styles.methods} onSubmit={confirm}>
          <fieldset className={styles.methods} aria-describedby={`${id}-availability`} disabled={saving}>
            <legend>Forma de pagamento</legend>
            {METHODS.map(({ value, description, icon: Icon }) => (
              <label className={styles.method} key={value}>
                <Icon aria-hidden="true" className={styles.icon} />
                <span>
                  <strong id={`${id}-${value}-label`}>{NEGOTIATION_PAYMENT_LABELS[value]}</strong>
                  <span id={`${id}-${value}-description`} className={styles.description}>{description}</span>
                </span>
                <input
                  type="radio"
                  name="payment-method"
                  value={value}
                  required
                  aria-labelledby={`${id}-${value}-label`}
                  aria-describedby={`${id}-${value}-description`}
                />
              </label>
            ))}
          </fieldset>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <Button type="submit" disabled={saving} className={styles.confirm}>
            {saving ? "Confirmando…" : "Confirmar forma de pagamento"}
          </Button>
        </form>
      )}
    </section>
  );
}
