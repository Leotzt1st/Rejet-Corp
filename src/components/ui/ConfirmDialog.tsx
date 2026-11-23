import { Button } from "./Button";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p style={{ fontSize: 14.5, color: "var(--color-text-soft)", marginBottom: 20, lineHeight: 1.6 }}>
        {message}
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Button variant="ghost" onClick={onCancel} disabled={loading} data-modal-initial-focus>
          {cancelLabel}
        </Button>
        <Button variant={variant} onClick={() => void onConfirm()} disabled={loading}>
          {loading ? "Processando…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
