import { useEffect, useId, useRef, type ReactNode } from "react";
import { FiX } from "react-icons/fi";
import styles from "./ui.module.css";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  size?: "md" | "lg";
}

export function Modal({ open, onClose, title, subtitle, children, size = "md" }: ModalProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const panel = dialog.current;
    const initial = panel?.querySelector<HTMLElement>("[data-modal-initial-focus]:not(:disabled)") ?? panel;
    initial?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKey = (event: KeyboardEvent) => {
      const panel = dialog.current;
      const panels = document.querySelectorAll('[aria-modal="true"]');
      if (panel !== panels.item(panels.length - 1)) return;
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && panel && !panel.contains(document.activeElement)) {
        event.preventDefault();
        panel.focus();
      }
    };

    document.addEventListener("keydown", handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={dialog}
        tabIndex={-1}
        className={`${styles.modal} ${size === "lg" ? styles.modalLg : ""}`}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
            "a[href], button, input, select, textarea, [tabindex]"
          )).filter((item) => item.tabIndex >= 0 && !item.matches(":disabled") && item.getClientRects().length > 0);
          const first = focusable[0];
          const last = focusable.at(-1);
          const current = document.activeElement;
          if (!first || (event.shiftKey && (current === first || current === event.currentTarget)) ||
            (!event.shiftKey && current === last)) {
            event.preventDefault();
            (event.shiftKey ? last : first)?.focus();
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
      >
        <button className={styles.modalClose} onClick={onClose} aria-label="Fechar">
          <FiX aria-hidden="true" />
        </button>

        {(title || subtitle) && (
          <div className={styles.modalHeader}>
            {title && <h2 className={styles.modalTitle} id={titleId}>{title}</h2>}
            {subtitle && <p className={styles.modalSubtitle}>{subtitle}</p>}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
