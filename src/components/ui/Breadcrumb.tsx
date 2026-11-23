import { Link } from "react-router-dom";
import { FiChevronRight } from "react-icons/fi";
import styles from "./ui.module.css";

export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className={styles.breadcrumb} aria-label="Trilha de navegação">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {item.to && !isLast ? (
              <Link className={styles.breadcrumbLink} to={item.to}>
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? styles.breadcrumbCurrent : ""}>{item.label}</span>
            )}
            {!isLast && <FiChevronRight className={styles.separator} />}
          </span>
        );
      })}
    </nav>
  );
}
