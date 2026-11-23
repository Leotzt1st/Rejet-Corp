import { FiArrowUpRight } from "react-icons/fi";

import MaterialYard from "../../home/MaterialYard/MaterialYard";
import styles from "./LoginCard.module.css";

interface LoginCardProps {
  onLogin: () => void;
  onRegister: () => void;
  demoMode?: boolean;
}

export default function LoginCard({
  onLogin,
  onRegister,
  demoMode = false,
}: LoginCardProps) {
  return (
    <aside className={styles.wrapper} aria-label="Fluxo de materiais e acesso">
      <MaterialYard />

      <div className={styles.divider} />

      {demoMode ? (
        <div className={styles.demoState} role="status">
          <span className={styles.demoDot} aria-hidden="true" />
          <span>
            <strong>Prévia pública</strong>
            <small>Login e cadastro exigem conexão com o Supabase.</small>
          </span>
        </div>
      ) : (
        <div className={styles.actions}>
          <button className={styles.primaryButton} type="button" onClick={onRegister}>
            Criar conta empresarial <FiArrowUpRight aria-hidden="true" />
          </button>
          <button className={styles.secondaryButton} type="button" onClick={onLogin}>
            Já tenho cadastro
          </button>
        </div>
      )}
    </aside>
  );
}
