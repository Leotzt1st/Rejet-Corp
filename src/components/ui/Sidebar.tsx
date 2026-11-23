import { Link } from "react-router-dom";
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { FiLogOut, FiX } from "react-icons/fi";
import styles from "./ui.module.css";
import { Avatar } from "./Avatar";
import { Badge } from "./Badge";

export interface SidebarItem {
  label: string;
  to?: string;
  icon?: ReactNode;
  badge?: number;
  active?: boolean;
  onClick?: () => void;
  section?: string;
}

interface SidebarProps {
  brand: { title: string; subtitle: string };
  items: SidebarItem[];
  open: boolean;
  onClose: () => void;
  user?: { name?: string | null; email?: string | null; logo?: string | null } | null;
  onLogout?: () => void;
  footer?: ReactNode;
}

export function Sidebar({ brand, items, open, onClose, user, onLogout, footer }: SidebarProps) {
  const sidebar = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const focusCloseButton = () => {
      if (!sidebar.current?.contains(document.activeElement) && closeButton.current?.getClientRects().length) {
        closeButton.current.focus({ preventScroll: true });
      }
    };
    const frame = requestAnimationFrame(focusCloseButton);
    const fallback = setTimeout(focusCloseButton, 260);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(fallback);
    };
  }, [open]);

  function handleKeys(event: KeyboardEvent<HTMLElement>) {
    if (!open || !closeButton.current?.getClientRects().length) return;
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = event.currentTarget.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)");
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  let lastSection: string | undefined;

  const renderedItems = items.map((item, index) => {
    const sectionChanged = item.section !== undefined && item.section !== lastSection;
    if (item.section !== undefined) lastSection = item.section;

    return (
      <div key={index}>
        {sectionChanged && <span className={styles.sidebarCategory}>{item.section}</span>}

        {item.to ? (
          <Link
            to={item.to}
            onClick={onClose}
            aria-current={item.active ? "page" : undefined}
            className={`${styles.sidebarLink} ${item.active ? styles.sidebarLinkActive : ""}`}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge ? (
              <span className={`${styles.badge} ${styles.badgeDanger} ${styles.sidebarBadge}`}>
                {item.badge}
              </span>
            ) : null}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => {
              item.onClick?.();
              onClose();
            }}
            className={`${styles.sidebarLink} ${item.active ? styles.sidebarLinkActive : ""}`}
            style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge ? <Badge variant="danger">{item.badge}</Badge> : null}
          </button>
        )}
      </div>
    );
  });

  return (
    <aside ref={sidebar} id="workspace-navigation" className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`} onKeyDown={handleKeys}>
      <div className={styles.sidebarHeader}>
        <Link to="/dashboard" className={styles.logoMark} onClick={onClose} aria-label={`${brand.title} — painel`}>
          <img src="/rejet-mark.png" alt="" aria-hidden="true" width="40" height="40" />
        </Link>
        <div>
          <div className={styles.logoTitle} translate="no" aria-label={brand.title}>
            Rejet <span className={styles.logoCorp}>Corp</span>
          </div>
          <div className={styles.logoSubtitle}>{brand.subtitle}</div>
        </div>
        <button type="button" ref={closeButton} className={styles.sidebarClose} onClick={onClose} aria-label="Fechar menu">
          <FiX aria-hidden="true" />
        </button>
      </div>

      <nav aria-label="Navegação da plataforma" className={styles.sidebarNav}>{renderedItems}</nav>

      {footer && <div className={styles.sidebarFooter}>{footer}</div>}

      {user && (
        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarUser}>
            <Avatar src={user.logo} name={user.name} size="sm" />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className={styles.sidebarUserName}>{user.name ?? "Empresa"}</div>
              <div className={styles.sidebarUserEmail}>{user.email ?? ""}</div>
            </div>
          </div>
          {onLogout && (
            <button
              className={`${styles.sidebarLink} ${styles.sidebarUser}`}
              onClick={onLogout}
              style={{ width: "100%", background: "none", border: "none", cursor: "pointer" }}
            >
              <FiLogOut /> Sair da conta
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
