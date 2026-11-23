import { useEffect, useMemo, useRef, useState } from "react";
import { FiDownload, FiPrinter } from "react-icons/fi";

import styles from "./RelatoriosPage.module.css";

import { Button, Card, Loader } from "../../components/ui";
import {
  listNegotiationsForReporting,
  summarizeNegotiations,
} from "../../services/negotiations/negotiationService";
import { listMyProducts } from "../../services/products/productService";
import { downloadCSV, printReport } from "../../services/exports/exportService";
import { useAuth } from "../../contexts/AuthContext";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatQuantity,
} from "../../utils/format";
import { countRecentMonths } from "../../utils/reporting";
import { negotiationMaterialName, negotiationReportTerms, NEGOTIATION_STATUS_LABELS, type Negotiation } from "../../types/negotiation";
import type { Product } from "../../types/product";

const monthName = new Intl.DateTimeFormat("pt-BR", { month: "short" });
const monthAndYear = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const ratingFormat = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function RelatoriosPage() {
  const { profile, user } = useAuth();
  const companyId = profile?.id ?? user?.id ?? null;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    companyId: string;
    attempt: number;
    products: Product[] | null;
    negotiations: Negotiation[] | null;
  } | null>(null);
  const current = result?.companyId === companyId && result.attempt === attempt ? result : null;
  const products = current?.products;
  const negotiations = current?.negotiations;
  const negStats = negotiations && companyId ? summarizeNegotiations(negotiations, companyId) : null;

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    void Promise.allSettled([listMyProducts(companyId), listNegotiationsForReporting(companyId)])
      .then(([products, negotiations]) => {
        if (cancelled) return;
        setResult({
          companyId,
          attempt,
          products: products.status === "fulfilled" ? products.value : null,
          negotiations: negotiations.status === "fulfilled" ? negotiations.value : null,
        });
      });
    return () => { cancelled = true; };
  }, [companyId, attempt]);

  const chart = useMemo(() => {
    const months = countRecentMonths(products ?? []);
    const max = Math.max(1, ...months.map(({ count }) => count));
    return months.map(({ date, count }) => ({
      date,
      count,
      height: count === 0 ? 0 : Math.max(10, Math.round((count / max) * 100)),
    }));
  }, [products]);

  const categoryChart = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products ?? []) {
      const category = product.category || "Sem categoria";
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    const sorted = [...counts]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const max = Math.max(1, ...sorted.map(([, c]) => c));
    return sorted.map(([name, count]) => ({
      name,
      count,
      pct: Math.round((count / max) * 100),
    }));
  }, [products]);

  function exportProducts() {
    if (!products?.length) return;
    downloadCSV("relatorio-produtos.csv", [
      "Produto",
      "Categoria",
      "Quantidade",
      "Unidade",
      "Preço",
      "Status",
      "Visualizações",
      "Data",
    ], products.map((product) => [
      product.product,
      product.category ?? "",
      product.quantities ?? "",
      product.unit ?? "",
      product.price ?? "",
      product.status,
      product.views ?? 0,
      formatDate(product.created_at),
    ]));
  }

  function exportNegotiations() {
    if (!negotiations?.length) return;
    downloadCSV("relatorio-negociacoes.csv", [
      "Produto",
      "Comprador",
      "Vendedor",
      "Quantidade",
      "Unidade",
      "Preço unitário",
      "Status",
      "Atualizado em",
    ], negotiations.map((negotiation) => {
      const { quantity, unit, unitPrice } = negotiationReportTerms(negotiation);
      return [
        negotiationMaterialName(negotiation),
        negotiation.buyer?.company_name ?? "",
        negotiation.seller?.company_name ?? "",
        quantity ?? "",
        unit ?? "",
        unitPrice ?? "",
        NEGOTIATION_STATUS_LABELS[negotiation.status],
        formatDate(negotiation.updated_at),
      ];
    }));
  }

  if (!current) {
    return <Loader text="Gerando relatório…" fullPage />;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Desempenho da empresa</h2>
          <p className={styles.subtitle}>
            Indicadores da sua empresa e exportação de dados.
          </p>
        </div>

        <div className={styles.exportActions}>
          <Button variant="outline" size="sm" onClick={exportProducts} disabled={!products?.length}>
            <FiDownload aria-hidden="true" /> Produtos (CSV)
          </Button>
          <Button variant="outline" size="sm" onClick={exportNegotiations} disabled={!negotiations?.length}>
            <FiDownload aria-hidden="true" /> Negociações (CSV)
          </Button>
          <Button variant="ghost" size="sm" onClick={() => printReport("Relatório geral", reportRef.current)} disabled={!products || !negotiations}>
            <FiPrinter aria-hidden="true" /> Imprimir
          </Button>
        </div>
      </div>

      {(!products || !negotiations) && (
        <Card>
          <p className={styles.emptyText} role="alert">Alguns dados do relatório estão indisponíveis.</p>
          <Button variant="outline" onClick={() => setAttempt((previous) => previous + 1)}>Tentar novamente</Button>
        </Card>
      )}

      <div ref={reportRef} className={styles.report}>
        <section className={styles.period}>
          <h2>Período: todo o histórico</h2>
          <p>Emitido em {new Date().toLocaleString("pt-BR")}</p>
        </section>

        <div className={styles.statsGrid}>
          <Card className={styles.stat}>
            <strong>{products ? formatNumber(products.filter((p) => p.status === "active" || p.status === "sold").length) : "—"}</strong>
            <span>Produtos publicados</span>
          </Card>
          <Card className={styles.stat}>
            <strong>{products ? formatNumber(products.filter((p) => p.status === "active").length) : "—"}</strong>
            <span>Produtos ativos</span>
          </Card>
          <Card className={styles.stat}>
            <strong>{negStats ? formatNumber(negStats.total) : "—"}</strong>
            <span>Negociações</span>
          </Card>
          <Card className={styles.stat}>
            <strong>{negStats ? formatNumber(negStats.completed) : "—"}</strong>
            <span>Finalizadas</span>
          </Card>
          <Card className={styles.stat}>
            <strong>{formatCurrency(negStats?.totalValue)}</strong>
            <span>Valor negociado</span>
            {negStats?.totalValue === null && <span>Há acordos sem valor confirmado.</span>}
          </Card>
          <Card className={styles.stat}>
            <strong>{negStats ? formatNumber(negStats.sales) : "—"}</strong>
            <span>Vendas concluídas</span>
          </Card>
          <Card className={styles.stat}>
            <strong>{negStats ? formatNumber(negStats.purchases) : "—"}</strong>
            <span>Compras concluídas</span>
          </Card>
          <Card className={styles.stat}>
            <strong>{profile?.review_count ? ratingFormat.format(profile.rating ?? 0) : "—"}</strong>
            <span>Avaliação média</span>
          </Card>
          <Card className={styles.stat}>
            <strong>
              {negStats && negStats.total > 0
                ? `${Math.round((negStats.completed / negStats.total) * 100)}%`
                : "—"}
            </strong>
            <span>Taxa de conversão</span>
          </Card>
          <Card className={styles.stat}>
            <strong>{products ? formatNumber(products.reduce((sum, product) => sum + (product.views ?? 0), 0)) : "—"}</strong>
            <span>Visualizações</span>
          </Card>
        </div>

        <div className={styles.columns}>
          <Card title="Produtos cadastrados nos últimos 12 meses" className={styles.chartCard}>
            {!products ? <p className={styles.emptyText}>Dados de produtos indisponíveis.</p> : !chart.some(({ count }) => count > 0) ? (
              <p className={styles.emptyText}>Nenhum produto cadastrado nesse período.</p>
            ) : <div className={styles.chart}>
              {chart.map((bar) => (
                <div key={bar.date.toISOString()} className={styles.chartCol} title={monthAndYear.format(bar.date)}>
                  <div className={styles.barArea}>
                    <span className={styles.barValue}>{bar.count}</span>
                    <div className={styles.bar} style={{ height: `${bar.height}%` }} />
                  </div>
                  <span className={styles.barLabel}>{monthName.format(bar.date).replace(".", "")}</span>
                </div>
              ))}
            </div>}
          </Card>

          <Card title="Negociações por status" className={styles.statusCard}>
            {negStats ? (
              <div className={styles.statusList}>
                {(Object.keys(negStats.byStatus) as (keyof typeof negStats.byStatus)[]).map(
                  (status) => (
                    <div key={status} className={styles.statusRow}>
                      <span className={styles.statusLabel}>
                        {NEGOTIATION_STATUS_LABELS[status]}
                      </span>
                      <span className={styles.statusValue}>
                        {negStats.byStatus[status]}
                      </span>
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className={styles.emptyText}>Dados de negociações indisponíveis.</p>
            )}
          </Card>
        </div>

        <Card title="Produtos por categoria">
          {!products ? <p className={styles.emptyText}>Dados de produtos indisponíveis.</p> : categoryChart.length === 0 ? (
            <p className={styles.emptyText}>Nenhum produto para categorizar.</p>
          ) : (
            <div className={styles.statusList}>
              {categoryChart.map((cat) => (
                <div key={cat.name} className={styles.statusRow}>
                  <span className={styles.statusLabel}>{cat.name}</span>
                  <div className={styles.catBar}>
                    <div className={styles.catBarFill} style={{ width: `${cat.pct}%` }} />
                  </div>
                  <span className={styles.statusValue}>{cat.count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Últimas negociações">
          {!negotiations ? <p className={styles.emptyText}>Dados de negociações indisponíveis.</p> : negotiations.length === 0 ? (
            <p className={styles.emptyText}>Nenhuma negociação registrada.</p>
          ) : (
            <div className={styles.tableWrap} role="region" aria-label="Tabela de negociações" tabIndex={0}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Status</th>
                    <th>Quantidade</th>
                    <th>Preço unitário</th>
                    <th>Atualizado em</th>
                  </tr>
                </thead>
                <tbody>
                  {negotiations.slice(0, 10).map((negotiation) => {
                    const { quantity, unit, unitPrice } = negotiationReportTerms(negotiation);
                    return (
                      <tr key={negotiation.id}>
                        <td>{negotiationMaterialName(negotiation)}</td>
                        <td>
                          <span className={styles.statusPill}>
                            {NEGOTIATION_STATUS_LABELS[negotiation.status]}
                          </span>
                        </td>
                        <td>{formatQuantity(quantity, unit)}</td>
                        <td>{formatCurrency(unitPrice)}</td>
                        <td>{formatDate(negotiation.updated_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
