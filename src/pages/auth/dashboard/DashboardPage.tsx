import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  FiBarChart2,
  FiArrowUpRight,
  FiBell,
  FiBriefcase,
  FiEye,
  FiMapPin,
  FiMessageSquare,
  FiPackage,
  FiPlusCircle,
} from "react-icons/fi";

import styles from "./DashboardPage.module.css";

import { Avatar, Badge, Button, Card, Loader, StarRating } from "../../../components/ui";
import { useAuth } from "../../../contexts/AuthContext";
import { useNotifications } from "../../../contexts/NotificationContext";
import { useMediaUrl } from "../../../hooks/useMediaUrl";
import { listMyProducts } from "../../../services/products/productService";
import { listNegotiationsForReporting, summarizeNegotiations } from "../../../services/negotiations/negotiationService";
import { listUserActivities, getActivityLabel } from "../../../services/activity/activityService";
import {
  formatCNPJ,
  formatCurrency,
  formatNumber,
  timeAgo,
} from "../../../utils/format";
import { countRecentMonths } from "../../../utils/reporting";
import type { Product } from "../../../types/product";
import { negotiationMaterialName, negotiationReportTerms, type Negotiation, type NegotiationStatus } from "../../../types/negotiation";
import type { ActivityLog } from "../../../types/activity";

function DashboardProductImage({ product }: { product: Product }) {
  const image = useMediaUrl(product.main_image);
  return image ? <img src={image} alt="" width={40} height={40} loading="lazy" /> : <FiPackage size={17} aria-hidden="true" />;
}

function DashboardPanel({ title, to, action, children }: {
  title: string;
  to?: string;
  action?: string;
  children: ReactNode;
}) {
  return (
    <Card className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2>{title}</h2>
        {to && action && (
          <Link to={to} className={styles.panelLink}>
            {action} <FiArrowUpRight aria-hidden="true" />
          </Link>
        )}
      </div>
      {children}
    </Card>
  );
}

const STATUS_VARIANT: Record<NegotiationStatus, "primary" | "secondary" | "success" | "danger" | "neutral"> = {
  interesse: "secondary",
  em_negociacao: "primary",
  aceito: "success",
  recusado: "danger",
  cancelado: "danger",
  finalizado: "neutral",
};

const STATUS_LABEL: Record<NegotiationStatus, string> = {
  interesse: "Interesse",
  em_negociacao: "Em negociação",
  aceito: "Aceito",
  recusado: "Recusado",
  cancelado: "Cancelado",
  finalizado: "Finalizado",
};

const STATUS_ORDER: NegotiationStatus[] = ["interesse", "em_negociacao", "aceito", "finalizado", "recusado", "cancelado"];
const shortMonth = new Intl.DateTimeFormat("pt-BR", { month: "short" });
const monthAndYear = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const ratingFormat = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const { notifications, unreadCount } = useNotifications();

  const companyId = profile?.id ?? user?.id ?? null;
  const currentUserId = companyId;

  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    companyId: string;
    attempt: number;
    products: Product[] | null;
    negotiations: Negotiation[] | null;
    activities: ActivityLog[] | null;
  } | null>(null);
  const current = result?.companyId === companyId && result.attempt === attempt ? result : null;
  const products = current?.products ?? [];
  const recentNegotiations = current?.negotiations ?? [];
  const activities = current?.activities ?? [];

  const today = useMemo(
    () =>
      new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    []
  );

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    void Promise.allSettled([
      listMyProducts(companyId),
      listNegotiationsForReporting(companyId),
      listUserActivities(companyId, 8),
    ]).then(([products, negotiations, activities]) => {
      if (cancelled) return;
      setResult({
        companyId,
        attempt,
        products: products.status === "fulfilled" ? products.value : null,
        negotiations: negotiations.status === "fulfilled" ? negotiations.value : null,
        activities: activities.status === "fulfilled" ? activities.value : null,
      });
    });
    return () => { cancelled = true; };
  }, [companyId, attempt]);

  const profileCompleteness = useMemo(() => {
    if (!profile) return 0;
    const fields = [
      profile.company_name,
      profile.cnpj,
      profile.email,
      profile.phone,
      profile.city,
      profile.state,
      profile.segment,
      profile.description,
      profile.logo_url,
    ];
    const filled = fields.filter((f) => f && f.trim && f.trim() !== "").length;
    return Math.round((filled / fields.length) * 100);
  }, [profile]);

  if (!current || !companyId) {
    return <Loader text="Carregando seu painel…" fullPage />;
  }

  const chart = countRecentMonths(products);
  const activeProducts = products.filter((product) => product.status === "active");
  const publishedProducts = activeProducts.slice(0, 5);
  const stats = summarizeNegotiations(recentNegotiations, companyId);
  const metrics = [
    { label: "Produtos ativos", value: current.products ? formatNumber(activeProducts.length) : "—" },
    { label: "Produtos publicados", value: current.products ? formatNumber(products.filter((p) => p.status === "active" || p.status === "sold").length) : "—" },
    { label: "Negociações em andamento", value: current.negotiations ? formatNumber(stats.byStatus.interesse + stats.byStatus.em_negociacao + stats.byStatus.aceito) : "—" },
    { label: "Visualizações", value: current.products ? formatNumber(products.reduce((sum, product) => sum + (product.views ?? 0), 0)) : "—" },
    { label: "Vendas concluídas", value: current.negotiations ? formatNumber(stats.sales) : "—" },
    { label: "Compras concluídas", value: current.negotiations ? formatNumber(stats.purchases) : "—" },
    { label: "Negociações finalizadas", value: current.negotiations ? formatNumber(stats.completed) : "—" },
    { label: "Avaliação média", value: profile?.review_count ? ratingFormat.format(profile.rating ?? 0) : "—" },
  ];
  const chartMax = Math.max(1, ...chart.map(({ count }) => count));
  const hasChartData = chart.some(({ count }) => count > 0);

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <h2>{profile?.company_name ?? "Painel da empresa"}</h2>
          <p>{today}</p>
        </div>
        <Button to="/cadastrar-produto" className={styles.publish}>
          <FiPlusCircle aria-hidden="true" /> Cadastrar produto
        </Button>
      </header>

      <nav className={styles.shortcuts} aria-label="Atalhos do painel">
        <Link to="/marketplace"><FiPackage aria-hidden="true" /> Marketplace</Link>
        <Link to="/negociacoes"><FiBriefcase aria-hidden="true" /> Negociações</Link>
        <Link to="/mensagens"><FiMessageSquare aria-hidden="true" /> Mensagens</Link>
        <Link to="/relatorios"><FiBarChart2 aria-hidden="true" /> Relatórios</Link>
      </nav>

      {(!current.products || !current.negotiations || !current.activities) && (
        <Card className={styles.panel}>
          <h2 className={styles.errorTitle} role="alert">Alguns dados do painel estão indisponíveis</h2>
          <p className={styles.empty}>Tente novamente para atualizar seus dados.</p>
          <Button variant="outline" onClick={() => setAttempt((previous) => previous + 1)}>Tentar novamente</Button>
        </Card>
      )}
        <>
          <section aria-labelledby="dashboard-summary">
            <h2 className={styles.sectionTitle} id="dashboard-summary">Resumo da operação</h2>
            <dl className={styles.metrics}>
              {metrics.map(({ label, value }) => (
                <div className={styles.metric} key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className={styles.grid}>
            <DashboardPanel title="Produtos por mês">
              <p className={styles.panelNote}>Últimos 12 meses</p>
              {!current.products ? <p className={styles.empty}>Dados de produtos indisponíveis.</p> : hasChartData ? (
                <ol className={styles.chart} role="list" aria-label="Produtos cadastrados por mês">
                  {chart.map(({ date, count }) => {
                    const label = monthAndYear.format(date);
                    return (
                      <li key={label} title={label} className={styles.chartCol}>
                        <div className={styles.barArea}>
                          <div className={styles.barMark} style={{ bottom: `${count / chartMax * 100}%` }}>
                            <span className={styles.visuallyHidden}>{label}, </span>
                            <span>{count}</span>
                          </div>
                          <div className={styles.bar} style={{ height: `${count / chartMax * 100}%` }} />
                        </div>
                        <span className={styles.barLabel} aria-hidden="true">{shortMonth.format(date).replace(".", "")}</span>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className={styles.empty}>Nenhum produto cadastrado nesse período.</p>
              )}
            </DashboardPanel>

            <DashboardPanel title="Negociações por status">
              {!current.negotiations ? <p className={styles.empty}>Dados de negociações indisponíveis.</p> : recentNegotiations.length === 0 ? (
                <p className={styles.empty}>Nenhuma negociação registrada.</p>
              ) : (
                <ul className={styles.statusList} role="list">
                  {STATUS_ORDER.map((status) => {
                    const count = stats.byStatus[status];
                    return (
                      <li key={status} className={styles.statusItem}>
                        <span>{STATUS_LABEL[status]}</span>
                        <strong>{formatNumber(count)}</strong>
                        <div className={styles.track} aria-hidden="true">
                          <div className={styles.fill} style={{ width: `${count / recentNegotiations.length * 100}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </DashboardPanel>

            <DashboardPanel title="Meus produtos" to="/produtos" action="Ver todos">
              {!current.products ? <p className={styles.empty}>Dados de produtos indisponíveis.</p> : publishedProducts.length === 0 ? (
                <p className={styles.empty}>Seus produtos ativos aparecerão aqui após a publicação.</p>
              ) : (
                <ul className={styles.list} role="list">
                  {publishedProducts.map((product) => (
                    <li key={product.id}>
                      <Link to={`/produto/${product.id}`} className={styles.productRow}>
                        <span className={styles.productThumb}><DashboardProductImage product={product} /></span>
                        <span className={styles.rowText}>
                          <strong>{product.product}</strong>
                          <span className={styles.rowMeta}>
                            {formatNumber(product.quantities)} {product.unit}
                            <span><FiEye aria-hidden="true" /> {formatNumber(product.views)} visualizações</span>
                          </span>
                        </span>
                        <span className={styles.price}>{product.is_free ? "Gratuito" : formatCurrency(product.price)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </DashboardPanel>

            <DashboardPanel title="Negociações recentes" to="/negociacoes" action="Ver todas">
              {!current.negotiations ? <p className={styles.empty}>Dados de negociações indisponíveis.</p> : recentNegotiations.length === 0 ? (
                <p className={styles.empty}>Explore o marketplace para iniciar uma negociação.</p>
              ) : (
                <ul className={styles.list} role="list">
                  {recentNegotiations.slice(0, 5).map((negotiation) => {
                    const other = negotiation.buyer_id === currentUserId ? negotiation.seller : negotiation.buyer;
                    return (
                      <li key={negotiation.id}>
                        <Link to={`/negociacoes/${negotiation.id}`} className={styles.negotiationRow}>
                          <Avatar src={other?.logo_url} name={other?.company_name} size="sm" />
                          <span className={styles.rowText}>
                            <strong>{negotiationMaterialName(negotiation)}</strong>
                            <span className={styles.rowMeta}>
                              {formatCurrency(negotiationReportTerms(negotiation).unitPrice)}
                              <time dateTime={negotiation.updated_at}>{timeAgo(negotiation.updated_at)}</time>
                            </span>
                          </span>
                          <Badge className={styles.statusBadge} variant={STATUS_VARIANT[negotiation.status]}>{STATUS_LABEL[negotiation.status]}</Badge>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </DashboardPanel>

            <DashboardPanel title="Notificações recentes" to="/notificacoes" action="Ver todas">
              {unreadCount > 0 && (
                <p className={styles.unread}>{unreadCount} {unreadCount === 1 ? "não lida" : "não lidas"}</p>
              )}
              {notifications.length === 0 ? (
                <p className={styles.empty}>Nenhuma notificação por aqui.</p>
              ) : (
                <ul className={styles.list} role="list">
                  {notifications.slice(0, 5).map((notification) => (
                    <li key={notification.id} className={styles.feedRow}>
                      <span className={styles.notifIcon}><FiBell aria-hidden="true" /></span>
                      <div className={styles.rowText}>
                        <strong>{notification.title}</strong>
                        {notification.message && <span className={styles.feedDetail}>{notification.message}</span>}
                        <time dateTime={notification.created_at}>{timeAgo(notification.created_at)}</time>
                      </div>
                      {!notification.read && <span className={styles.dot}><span className={styles.visuallyHidden}>Não lida</span></span>}
                    </li>
                  ))}
                </ul>
              )}
            </DashboardPanel>

            <DashboardPanel title="Perfil da empresa" to="/perfil" action="Editar perfil">
              <div className={styles.profileTop}>
                <Avatar src={profile?.logo_url} name={profile?.company_name ?? user?.email} size="lg" />
                <div className={styles.rowText}>
                  <strong>{profile?.company_name ?? "Minha empresa"}</strong>
                  {profile?.segment && <span className={styles.feedDetail}>{profile.segment}</span>}
                  <StarRating value={profile?.rating} count={profile?.review_count} size="sm" readOnly />
                </div>
                {profile?.verified && <Badge className={styles.statusBadge} variant="success">Verificada</Badge>}
              </div>
              <div className={styles.profileMeta}>
                {profile?.cnpj && <span><FiBriefcase aria-hidden="true" /> {formatCNPJ(profile.cnpj)}</span>}
                {(profile?.city || profile?.state) && (
                  <span><FiMapPin aria-hidden="true" /> {[profile.city, profile.state].filter(Boolean).join(", ")}</span>
                )}
              </div>
              <div className={styles.completeness}>
                <span>Perfil completo</span>
                <strong>{profileCompleteness}%</strong>
                <div className={styles.track} aria-hidden="true">
                  <div className={styles.fill} style={{ width: `${profileCompleteness}%` }} />
                </div>
              </div>
            </DashboardPanel>

            <DashboardPanel title="Atividades recentes">
              {!current.activities ? <p className={styles.empty}>Dados de atividades indisponíveis.</p> : activities.length === 0 ? (
                <p className={styles.empty}>Nenhuma atividade registrada.</p>
              ) : (
                <ul className={styles.list} role="list">
                  {activities.map((activity) => (
                    <li key={activity.id} className={styles.feedRow}>
                      <span className={styles.activityDot} aria-hidden="true" />
                      <div className={styles.rowText}>
                        <strong>{getActivityLabel(activity.action)}</strong>
                        {activity.details && <span className={styles.feedDetail}>{activity.details}</span>}
                        <time dateTime={activity.created_at}>{timeAgo(activity.created_at)}</time>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </DashboardPanel>
          </div>
        </>
    </div>
  );
}

