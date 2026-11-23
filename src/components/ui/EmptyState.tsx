import type { ReactNode } from "react";
import { FiInbox } from "react-icons/fi";
import styles from "./ui.module.css";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon = <FiInbox />, title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon} aria-hidden="true">{icon}</span>
      <h3 className={styles.emptyTitle}>{title}</h3>
      {description && <p className={styles.emptyText}>{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}
