import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import styles from "./ui.module.css";
import { usePagination } from "../../hooks/usePagination";

interface PaginationProps {
  totalPages: number;
  page: number;
  onChange: (page: number) => void;
}

export function Pagination({ totalPages, page, onChange }: PaginationProps) {
  const pagination = usePagination(totalPages, page);

  if (totalPages <= 1) return null;

  return (
    <nav className={styles.pagination} aria-label="Paginação">
      <button
        className={styles.pageBtn}
        onClick={() => onChange(page - 1)}
        disabled={!pagination.canGoPrev}
        aria-label="Página anterior"
      >
        <FiChevronLeft />
      </button>

      {pagination.pages.map((p, index) =>
        p === "ellipsis" ? (
          <span key={`e-${index}`} className={styles.pageEllipsis}>
            …
          </span>
        ) : (
          <button
            key={p}
            className={`${styles.pageBtn} ${p === page ? styles.pageBtnActive : ""}`}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        )
      )}

      <button
        className={styles.pageBtn}
        onClick={() => onChange(page + 1)}
        disabled={!pagination.canGoNext}
        aria-label="Próxima página"
      >
        <FiChevronRight />
      </button>
    </nav>
  );
}
