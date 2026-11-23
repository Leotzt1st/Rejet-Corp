import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  FiBarChart2,
  FiBell,
  FiChevronDown,
  FiGrid,
  FiHeart,
  FiHome,
  FiLogOut,
  FiMenu,
  FiMessageSquare,
  FiPackage,
  FiPlusCircle,
  FiSearch,
  FiSettings,
  FiShoppingBag,
  FiUser,
} from "react-icons/fi";

import styles from "./AppLayout.module.css";

import { Sidebar, Avatar, Badge } from "../../ui";
import { useAuth } from "../../../contexts/AuthContext";
import { useNotifications } from "../../../contexts/NotificationContext";
import { signOut } from "../../../services/auth/authService";
import { NOTIFICATION_ICONS } from "../../../types/notification";
import { timeAgo } from "../../../utils/format";

interface NavItem {
  label: string;
  to: string;
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", section: "Principal" },
  { label: "Marketplace", to: "/marketplace" },
  { label: "Meus Produtos", to: "/produtos", section: "Produtos" },
  { label: "Cadastrar Produto", to: "/cadastrar-produto" },
  { label: "Negociações", to: "/negociacoes", section: "Negócios" },
  { label: "Financeiro", to: "/financeiro", section: "Negócios" },
  { label: "Mensagens", to: "/mensagens" },
  { label: "Favoritos", to: "/favoritos" },
  { label: "Perfil da Empresa", to: "/perfil", section: "Conta" },
  { label: "Notificações", to: "/notificacoes" },
  { label: "Relatórios", to: "/relatorios" },
  { label: "Configurações", to: "/config" },
];

const SECTION_ICONS: Record<string, React.ReactNode> = {
  Dashboard: <FiHome />,
  Marketplace: <FiGrid />,
  "Meus Produtos": <FiPackage />,
  "Cadastrar Produto": <FiPlusCircle />,
  Negociações: <FiShoppingBag />,
  Mensagens: <FiMessageSquare />,
  Favoritos: <FiHeart />,
  "Perfil da Empresa": <FiUser />,
  Notificações: <FiBell />,
  Relatórios: <FiBarChart2 />,
  Configurações: <FiSettings />,
};

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/marketplace": "Marketplace",
  "/produtos": "Meus Produtos",
  "/cadastrar-produto": "Cadastrar produto",
  "/negociacoes": "Negociações",
  "/financeiro": "Financeiro",
  "/mensagens": "Mensagens",
  "/favoritos": "Favoritos",
  "/perfil": "Perfil da Empresa",
  "/notificacoes": "Notificações",
  "/relatorios": "Relatórios",
  "/config": "Configurações",
  "/admin": "Administração",
};

export default function AppLayout() {
  const { profile, user } = useAuth();
  const { unreadCount, notifications, markAllRead } = useNotifications();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [search, setSearch] = useState("");

  const location = useLocation();
  const navigate = useNavigate();

  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setSidebarOpen(false);
    setNotifOpen(false);
    setUserOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (notifRef.current && !notifRef.current.contains(target)) {
        setNotifOpen(false);
      }
      if (userRef.current && !userRef.current.contains(target)) {
        setUserOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleLogout() {
    await signOut();
    navigate("/");
  }

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/marketplace?q=${encodeURIComponent(query)}` : "/marketplace");
  }

  function closeSidebar() {
    setSidebarOpen(false);
    if (sidebarOpen && menuButton.current?.getClientRects().length) menuButton.current.focus();
  }

  const isAdmin = profile?.role === "admin";
  const activePath = location.pathname;
  const isEditingProduct = activePath === "/cadastrar-produto" && Boolean(new URLSearchParams(location.search).get("edit"));
  const section = activePath.startsWith("/produto/") ? "Anúncio" : activePath.startsWith("/negociacoes/") ? "Negociação" : TITLES[activePath];
  const activeKey = isEditingProduct ? "Editar produto" : (section ?? "Painel");

  const sidebarItems = NAV_ITEMS.filter(
    (item) => item.to !== "/admin"
  ).map((item) => ({
    label: item.label,
    to: item.to,
    section: item.section,
    icon: SECTION_ICONS[item.label],
    active: activePath === item.to || activePath.startsWith(`${item.to}/`) ||
      (item.to === "/marketplace" && activePath.startsWith("/produto/")),
    badge:
      item.label === "Mensagens" && unreadCount > 0
        ? unreadCount
        : undefined,
  }));

  if (isAdmin) {
    sidebarItems.push({
      label: "Painel Admin",
      to: "/admin",
      section: "Administração",
      icon: <FiSettings />,
      active: activePath.startsWith("/admin"),
      badge: undefined,
    });
  }

  return (
    <div className={styles.app}>
      <a className={styles.skipLink} href="#app-conteudo">
        Pular para o conteúdo
      </a>
      <Sidebar
        brand={{ title: "Rejet Corp", subtitle: "Economia Circular B2B" }}
        items={sidebarItems}
        open={sidebarOpen}
        onClose={closeSidebar}
        user={{
          name: profile?.company_name ?? user?.email ?? "Empresa",
          email: profile?.trade_name ?? user?.email ?? "",
          logo: profile?.logo_url ?? null,
        }}
        onLogout={handleLogout}
      />

      {sidebarOpen && (
        <div className={styles.backdrop} onClick={closeSidebar} />
      )}

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarInner}>
            <button
              type="button"
              ref={menuButton}
              className={styles.menuBtn}
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menu"
              aria-controls="workspace-navigation"
              aria-expanded={sidebarOpen}
              onKeyDown={(event) => {
                if (event.key === "Escape" && sidebarOpen) closeSidebar();
              }}
            >
              <FiMenu aria-hidden="true" />
            </button>

            <h1 className={styles.pageTitle}>{activeKey}</h1>

            {activePath !== "/marketplace" && (
              <form className={styles.search} onSubmit={handleSearch}>
                <FiSearch aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Buscar no marketplace…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Buscar"
                />
              </form>
            )}

            <div className={styles.actions}>
              <div className={styles.actionWrap} ref={notifRef}>
                <button
                  type="button"
                  className={`${styles.iconBtn} ${notifOpen ? styles.iconBtnActive : ""}`}
                  onClick={() => setNotifOpen((value) => !value)}
                  aria-label="Notificações"
                >
                  <FiBell />
                  {unreadCount > 0 && (
                    <span className={styles.badge}>{unreadCount}</span>
                  )}
                </button>

                {notifOpen && (
                  <div className={styles.dropdown}>
                    <div className={styles.dropdownHeader}>
                      <strong>Notificações</strong>
                      {unreadCount > 0 && (
                        <button type="button" onClick={markAllRead}>
                          Marcar todas como lidas
                        </button>
                      )}
                    </div>

                    <div className={styles.dropdownList}>
                      {notifications.length === 0 ? (
                        <p className={styles.dropdownEmpty}>
                          Nenhuma notificação por aqui.
                        </p>
                      ) : (
                        notifications.slice(0, 5).map((notification) => (
                          <Link
                            key={notification.id}
                            to={notification.link ?? "/notificacoes"}
                            className={styles.notifItem}
                          >
                            <span className={styles.notifIcon}>
                              {NOTIFICATION_ICONS[notification.type]}
                            </span>
                            <span className={styles.notifBody}>
                              <span className={styles.notifTitle}>
                                {notification.title}
                              </span>
                              {notification.message && (
                                <span className={styles.notifMsg}>
                                  {notification.message}
                                </span>
                              )}
                              <span className={styles.notifTime}>
                                {timeAgo(notification.created_at)}
                              </span>
                            </span>
                          </Link>
                        ))
                      )}
                    </div>

                    <div className={styles.dropdownFooter}>
                      <Link to="/notificacoes">Ver todas</Link>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.actionWrap} ref={userRef}>
                <button
                  type="button"
                  className={styles.userBtn}
                  onClick={() => setUserOpen((value) => !value)}
                  aria-label="Menu do usuário"
                >
                  <Avatar
                    src={profile?.logo_url ?? null}
                    name={profile?.company_name ?? user?.email}
                    size="sm"
                  />
                  <span className={styles.userName}>
                    {profile?.company_name?.split(" ")[0] ?? "Conta"}
                  </span>
                  <FiChevronDown size={14} />
                </button>

                {userOpen && (
                  <div className={styles.dropdown}>
                    <div className={styles.userCard}>
                      <Avatar
                        src={profile?.logo_url ?? null}
                        name={profile?.company_name ?? user?.email}
                        size="lg"
                      />
                      <div>
                        <div className={styles.userCardName}>
                          {profile?.company_name ?? "Minha conta"}
                        </div>
                        <div className={styles.userCardEmail}>
                          {profile?.email ?? user?.email}
                        </div>
                        {profile?.verified && (
                          <Badge variant="success">Verificada</Badge>
                        )}
                      </div>
                    </div>

                    <div className={styles.userMenu}>
                      <Link to="/perfil">
                        <FiUser /> Perfil da Empresa
                      </Link>
                      <Link to="/config">
                        <FiSettings /> Configurações
                      </Link>
                      {isAdmin && (
                        <Link to="/admin">
                          <FiSettings /> Painel Admin
                        </Link>
                      )}
                      <button type="button" onClick={handleLogout}>
                        <FiLogOut /> Sair da conta
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className={styles.content} id="app-conteudo" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
