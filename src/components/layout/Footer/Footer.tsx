import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer} id="footer">
      <div className={styles["footer-container"]}>
        <div className={styles["footer-brand"]}>
          <div className={styles["footer-logo"]}>
            <img className={styles["logo-mark"]} src="/rejet-mark.png" alt="" aria-hidden="true" width="40" height="40" />

            <div className={styles["logo-text"]}>
              <span className={styles["logo-title"]}>
                <span translate="no">Rejet <span className={styles["logo-corp"]}>Corp</span></span>
              </span>

              <span className={styles["logo-subtitle"]}>
                Materiais em novo ciclo
              </span>
            </div>
          </div>

          <p>
            Marketplace B2B para conectar excedentes industriais a novos usos
            e aproximar empresas pela economia circular.
          </p>
        </div>

        <div className={styles["footer-links"]}>
          <nav className={styles["footer-column"]} aria-label="Navegação do rodapé">
            <h2>Navegação</h2>

            <a href="/#inicio">Início</a>
            <a href="/#empresa">Empresa</a>
            <a href="/informacoes#privacidade">Privacidade e dados</a>
            <a href="/informacoes#cookies">Cookies e rastreamento</a>
            <a href="/informacoes#termos">Uso da plataforma</a>
            <a href="/informacoes#reembolsos">Pagamentos e reembolsos</a>
            <a href="mailto:contato@rejet.com">Contato</a>
          </nav>

          <div className={styles["footer-column"]}>
            <h2>Contato</h2>

            <a href="mailto:contato@rejet.com">contato@rejet.com</a>
            <p>Atendimento corporativo</p>
            <p>Brasil</p>
          </div>
        </div>
      </div>

      <div className={styles["footer-bottom"]}>
        <p>
          © 2026 <span translate="no">Rejet Corp</span>. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
