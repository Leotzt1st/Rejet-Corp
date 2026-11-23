import { FiArrowUpRight } from "react-icons/fi";

import styles from "./Highlight.module.css";

interface HighlightProps {
  onLogin?: () => void;
  disabled?: boolean;
}

export default function Highlight({
  onLogin,
  disabled = false,
}: HighlightProps) {
  return (
    <section className={styles["highlight-section"]}>
      <div className={styles["highlight-box"]}>
        <div className={styles["highlight-copy"]}>
          <p className={styles["section-tag"]}>Para sua operação</p>
          <h2>Dê ao excedente um próximo destino.</h2>
          <p className={styles["highlight-description"]}>
            Conecte sua empresa a uma rede que transforma materiais parados
            em novas possibilidades de negócio.
          </p>
        </div>

        <div className={styles["highlight-action"]}>
          <span>Economia circular, entre empresas.</span>
          <button
            className={styles["highlight-btn"]}
            type="button"
            disabled={disabled}
            title={disabled ? "Conecte o Supabase para habilitar" : undefined}
            onClick={onLogin}
          >
            Acessar plataforma <FiArrowUpRight aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
