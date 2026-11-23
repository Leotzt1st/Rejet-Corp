import { useState, type FormEvent } from "react";
import { FiDollarSign } from "react-icons/fi";

import styles from "./NegotiationModal.module.css";

import { Button, Input, Modal, Textarea } from "../../ui";
import { createNegotiation } from "../../../services/negotiations/negotiationService";
import { useToast } from "../../ui/Toast";
import { useAuth } from "../../../contexts/AuthContext";
import { formatCurrency } from "../../../utils/format";
import type { Product } from "../../../types/product";

interface NegotiationModalProps {
  open: boolean;
  product: Product;
  onClose: () => void;
  onCreated: () => void;
}

export default function NegotiationModal({
  open,
  product,
  onClose,
  onCreated,
}: NegotiationModalProps) {
  const { success, error } = useToast();
  const { profile, user } = useAuth();
  const currentUserId = profile?.id ?? user?.id ?? null;
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setQuantity("");
    setPrice("");
    setMessage("");
  }

  function close() {
    reset();
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!message.trim()) {
      error("Escreva uma mensagem para o vendedor.");
      return;
    }

    if (!currentUserId) {
      error("Você precisa estar autenticado.");
      return;
    }
    if (!product.unit) {
      error("Atualize o anúncio para conferir a unidade do material.");
      return;
    }

    setSubmitting(true);
    try {
      await createNegotiation(currentUserId, {
        product_id: product.id,
        proposed_unit: product.unit,
        quantity: quantity ? Number(quantity) : undefined,
        offered_price: price ? Number(price) : undefined,
        message: message.trim(),
      });
      success("Interesse enviado com sucesso!");
      onCreated();
      close();
    } catch (err) {
      error(err instanceof Error ? err.message : "Falha ao enviar interesse.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Enviar interesse"
      subtitle={`${product.product} — ${formatCurrency(product.price)}`}
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.row}>
          <Input
            label={product.unit ? `Quantidade (${product.unit})` : "Quantidade"}
            name="quantity"
            type="number"
            min={0}
            step="any"
            placeholder={product.unit ?? "0"}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          <Input
            label={product.unit ? `Preço por ${product.unit}` : "Preço unitário oferecido"}
            name="offered_price"
            type="number"
            min={0}
            step="any"
            icon={<FiDollarSign />}
            placeholder="R$ 0,00"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </div>

        <Textarea
          label="Mensagem"
          name="message"
          required
          placeholder="Explique o que sua empresa precisa e por que quer negociar..."
          rows={4}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />

        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Enviando…" : "Enviar interesse"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
