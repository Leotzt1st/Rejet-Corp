import "./Navbar.css";

interface NavbarProps {
  onLogin: () => void;
  onRegister: () => void;
  onAboutNavigate: () => void;
  authDisabled: boolean;
}

export default function Navbar({ onLogin, onRegister, onAboutNavigate, authDisabled }: NavbarProps) {
  return (
    <header className="navbar">
      <div className="nav-container">
        <a href="#inicio" className="nav-logo">
          <img className="logo-mark" src="/rejet-mark.png" alt="" width="46" height="46" />
          <div className="logo-text">
            <span className="logo-title" translate="no">Rejet <span>Corp</span></span>
            <span className="logo-subtitle">Materiais em novo ciclo</span>
          </div>
        </a>
        <nav className="nav-menu" aria-label="Navegação principal">
          <a href="#empresa" onClick={(event) => {
            if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) onAboutNavigate();
          }}>Sobre</a>
          <a href="#empresas">Empresas</a>
          <a href="#impacto">Impacto</a>
          <a href="/informacoes">Conteúdo</a>
        </nav>
        <div className="nav-actions">
          <button className="nav-btn-outline" type="button" disabled={authDisabled} onClick={onLogin}>Entrar</button>
          <button className="nav-btn" type="button" disabled={authDisabled} onClick={onRegister}>Cadastre sua empresa</button>
        </div>
      </div>
    </header>
  );
}
