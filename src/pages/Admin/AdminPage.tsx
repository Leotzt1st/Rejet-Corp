import { useCallback, useEffect, useState } from "react";
import { FiBriefcase, FiPackage, FiShield } from "react-icons/fi";

import styles from "./AdminPage.module.css";

import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, Loader, Select } from "../../components/ui";
import {
  adminDeleteCompany,
  adminArchiveProduct,
  adminListCompanies,
  adminListProducts,
  adminToggleCompanyActive,
  adminToggleCompanyVerified,
  getAdminDashboard,
  type AdminCompany,
  type AdminDashboardData,
} from "../../services/admin/adminService";
import { useAuth } from "../../contexts/AuthContext";
import { AdminMfa } from "../../components/auth/AdminMfa";
import { listReports, updateReportStatus } from "../../services/reports/reportService";
import { useToast } from "../../components/ui/Toast";
import { formatCNPJ, formatCurrency, formatDate, formatNumber } from "../../utils/format";
import type { Company } from "../../types/company";
import type { Product } from "../../types/product";
import type { Report, ReportStatus } from "../../types/report";

type Tab = "overview" | "companies" | "products" | "reports";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Visão geral" },
  { key: "companies", label: "Empresas" },
  { key: "products", label: "Produtos" },
  { key: "reports", label: "Denúncias" },
];

const REPORT_STATUS: Record<ReportStatus, "warning" | "secondary" | "success" | "danger"> = {
  pending: "warning",
  reviewing: "secondary",
  resolved: "success",
  rejected: "danger",
};

export default function AdminPage() {
  const { profile, adminMfa } = useAuth();
  if (profile?.role === "admin" && !adminMfa) return <AdminMfa />;
  return <AdminContent />;
}

function AdminContent() {
  const { success, error } = useToast();
  const { profile } = useAuth();

  const [tab, setTab] = useState<Tab>("overview");

  const [overview, setOverview] = useState<AdminDashboardData | null>(null);
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [productFilter, setProductFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [companyToVerify, setCompanyToVerify] = useState<AdminCompany | null>(null);
  const [productToArchive, setProductToArchive] = useState<Product | null>(null);

  const refreshOverview = useCallback(async () => {
    try {
      setOverview(await getAdminDashboard());
    } catch {
      setOverview(null);
    }
  }, []);

  const refreshCompanies = useCallback(async () => {
    try {
      setCompanies(await adminListCompanies());
    } catch {
      setCompanies([]);
    }
  }, []);

  const refreshProducts = useCallback(async () => {
    try {
      setProducts(await adminListProducts(productFilter || undefined));
    } catch {
      setProducts([]);
    }
  }, [productFilter]);

  const refreshReports = useCallback(async () => {
    try {
      setReports(await listReports());
    } catch {
      setReports([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      refreshOverview(),
      refreshCompanies(),
      refreshProducts(),
      refreshReports(),
    ]).finally(() => setLoading(false));
  }, [refreshOverview, refreshCompanies, refreshProducts, refreshReports]);

  async function toggleVerified(company: AdminCompany) {
    try {
      await adminToggleCompanyVerified(company);
      setCompanies((current) =>
        current.map((item) =>
          item.id === company.id ? { ...item, verified: !company.verified } : item
        )
      );
      success(company.verified ? "Verificação removida." : "Empresa verificada.");
    } catch (err) {
      error(err instanceof Error ? err.message : "Falha ao atualizar verificação.");
      void refreshCompanies();
    }
  }

  async function toggleActive(company: Company) {
    try {
      await adminToggleCompanyActive(company.id, !company.active);
      setCompanies((current) =>
        current.map((item) =>
          item.id === company.id ? { ...item, active: !company.active } : item
        )
      );
      success(company.active ? "Empresa desativada." : "Empresa ativada.");
    } catch {
      error("Falha ao atualizar status da empresa.");
    }
  }

  function removeCompany(company: Company) {
    setCompanyToDelete(company);
  }

  async function confirmDeleteCompany() {
    if (!companyToDelete) return;
    const company = companyToDelete;
    setCompanyToDelete(null);
    try {
      await adminDeleteCompany(company.id);
      setCompanies((current) => current.filter((item) => item.id !== company.id));
      success("Empresa excluída.");
      void refreshOverview();
    } catch {
      error("Falha ao excluir empresa.");
    }
  }

  function archiveProduct(product: Product) {
    setProductToArchive(product);
  }

  async function confirmArchiveProduct() {
    if (!productToArchive) return;
    const product = productToArchive;
    setProductToArchive(null);
    try {
      await adminArchiveProduct(product.id);
      setProducts((current) =>
        productFilter && productFilter !== "inactive"
          ? current.filter((item) => item.id !== product.id)
          : current.map((item) =>
              item.id === product.id ? { ...item, status: "inactive" } : item
            )
      );
      success("Produto arquivado.");
      void refreshOverview();
    } catch {
      error("Falha ao arquivar produto.");
    }
  }

  async function setReportStatus(report: Report, status: ReportStatus) {
    try {
      await updateReportStatus(report.id, status);
      setReports((current) =>
        current.map((item) => (item.id === report.id ? { ...item, status } : item))
      );
      success("Denúncia atualizada.");
    } catch {
      error("Falha ao atualizar denúncia.");
    }
  }

  if (loading) {
    return <Loader text="Carregando painel admin..." fullPage />;
  }

  if (profile?.role !== "admin") {
    return (
      <div className={styles.denied}>
        <span className={styles.deniedIcon}>🔒</span>
        <h2>Acesso restrito</h2>
        <p>
          Esta área é exclusiva para administradores da plataforma.
          Entre com uma conta com privilégios de administrador.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>Painel Administrativo</h2>
      </div>

      <nav className={styles.tabs} aria-label="Áreas administrativas">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={tab === item.key}
            className={`${styles.tab} ${tab === item.key ? styles.tabActive : ""}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <>
          <div className={styles.statsGrid}>
            <Card className={styles.stat}>
              <strong>{formatNumber(overview?.totalCompanies)}</strong>
              <span>Empresas</span>
            </Card>
            <Card className={styles.stat}>
              <strong>{formatNumber(overview?.totalProducts)}</strong>
              <span>Produtos</span>
            </Card>
            <Card className={styles.stat}>
              <strong>{formatNumber(overview?.activeProducts)}</strong>
              <span>Produtos ativos</span>
            </Card>
            <Card className={styles.stat}>
              <strong>{formatNumber(overview?.totalNegotiations)}</strong>
              <span>Negociações</span>
            </Card>
            <Card className={styles.stat}>
              <strong>{formatNumber(overview?.finishedNegotiations)}</strong>
              <span>Finalizadas</span>
            </Card>
            <Card className={styles.stat}>
              <strong>{formatNumber(overview?.pendingReports)}</strong>
              <span>Denúncias pendentes</span>
            </Card>
            <Card className={styles.stat}>
              <strong>{formatNumber(overview?.totalReports)}</strong>
              <span>Total de denúncias</span>
            </Card>
            <Card className={styles.stat}>
              <strong>{formatNumber(overview?.totalUsers)}</strong>
              <span>Usuários</span>
            </Card>
          </div>

          <Card title="Empresas recentes">
            {companies.length === 0 ? (
              <p className={styles.emptyText}>Nenhuma empresa cadastrada.</p>
            ) : (
              <div className={styles.tableWrap} role="region" aria-label="Tabela de empresas recentes" tabIndex={0}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th>Local</th>
                      <th>Status</th>
                      <th>Cadastro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.slice(0, 6).map((company) => (
                      <tr key={company.id}>
                        <td className={styles.companyCell}>
                          <Avatar src={company.logo_url} name={company.company_name} size="sm" />
                          <span>{company.company_name}</span>
                        </td>
                        <td>{[company.city, company.state].filter(Boolean).join(", ") || "—"}</td>
                        <td>
                          <Badge variant={company.active ? "success" : "danger"}>
                            {company.active ? "Ativa" : "Inativa"}
                          </Badge>{" "}
                          {company.verified && <Badge variant="secondary">Verificada</Badge>}
                        </td>
                        <td>{formatDate(company.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {tab === "companies" && (
        <Card>
          {companies.length === 0 ? (
            <EmptyState icon={<FiBriefcase aria-hidden="true" />} title="Nenhuma empresa" />
          ) : (
            <div className={styles.tableWrap} role="region" aria-label="Tabela de empresas" tabIndex={0}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>CNPJ</th>
                    <th>Local</th>
                    <th>Segmento</th>
                    <th>Verificada</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <tr key={company.id}>
                      <td className={styles.companyCell}>
                        <Avatar src={company.logo_url} name={company.company_name} size="sm" />
                        <span>{company.company_name}</span>
                      </td>
                      <td>{company.cnpj ?? "—"}</td>
                      <td>{[company.city, company.state].filter(Boolean).join(", ") || "—"}</td>
                      <td>{company.segment ?? "—"}</td>
                      <td>
                        <Badge variant={company.verified ? "success" : "neutral"}>
                          {company.verified ? "Sim" : "Não"}
                        </Badge>
                      </td>
                      <td>
                        <Badge variant={company.active ? "success" : "danger"}>
                          {company.active ? "Ativa" : "Inativa"}
                        </Badge>
                      </td>
                      <td>
                        <div className={styles.cellActions}>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => company.verified ? void toggleVerified(company) : setCompanyToVerify(company)}
                          >
                            {company.verified ? "Remover verificação" : "Verificar"}
                          </Button>
                          <Button
                            size="sm"
                            variant={company.active ? "danger" : "success"}
                            onClick={() => toggleActive(company)}
                          >
                            {company.active ? "Desativar" : "Ativar"}
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => removeCompany(company)}>
                            Excluir
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "products" && (
        <Card>
          <div className={styles.filterRow}>
            <Select
              name="status"
              value={productFilter}
              onChange={(event) => setProductFilter(event.target.value)}
              options={[
                { value: "", label: "Todos os status" },
                { value: "active", label: "Ativos" },
                { value: "inactive", label: "Inativos" },
                { value: "sold", label: "Vendidos" },
              ]}
            />
          </div>

          {products.length === 0 ? (
            <EmptyState icon={<FiPackage aria-hidden="true" />} title="Nenhum produto" />
          ) : (
            <div className={styles.tableWrap} role="region" aria-label="Tabela de produtos" tabIndex={0}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Empresa</th>
                    <th>Preço</th>
                    <th>Status</th>
                    <th>Cadastro</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>{product.product}</td>
                      <td>{product.company?.company_name ?? "—"}</td>
                      <td>{formatCurrency(product.price)}</td>
                      <td>
                        <Badge
                          variant={
                            product.status === "active"
                              ? "success"
                              : product.status === "sold"
                                ? "danger"
                                : "neutral"
                          }
                        >
                          {product.status}
                        </Badge>
                      </td>
                      <td>{formatDate(product.created_at)}</td>
                      <td>
                        <Button size="sm" variant="danger" onClick={() => archiveProduct(product)}>
                          Arquivar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "reports" && (
        <Card>
          {reports.length === 0 ? (
            <EmptyState icon={<FiShield aria-hidden="true" />} title="Nenhuma denúncia" description="Denúncias de usuários aparecerão aqui." />
          ) : (
            <div className={styles.reportsList}>
              {reports.map((report) => (
                <div key={report.id} className={styles.reportItem}>
                  <div className={styles.reportBody}>
                    <div className={styles.reportTop}>
                      <Badge variant={REPORT_STATUS[report.status]}>{report.status}</Badge>
                      <span className={styles.reportDate}>{formatDate(report.created_at)}</span>
                    </div>
                    <p className={styles.reportReason}>{report.reason}</p>
                    <span className={styles.reportMeta}>
                      Alvo: {report.target_type} ({report.target_id})
                    </span>
                  </div>
                  <div className={styles.cellActions}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setReportStatus(report, "reviewing")}
                    >
                      Em análise
                    </Button>
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => setReportStatus(report, "resolved")}
                    >
                      Resolver
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setReportStatus(report, "rejected")}
                    >
                      Rejeitar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <ConfirmDialog
        open={companyToVerify !== null}
        title="Verificar empresa"
        message={`Confirme que você conferiu o CNPJ ${formatCNPJ(companyToVerify?.cnpj) || "não informado"} e o vínculo do responsável com "${companyToVerify?.company_name}".`}
        confirmLabel="Confirmar verificação"
        onConfirm={() => {
          if (companyToVerify) void toggleVerified(companyToVerify);
          setCompanyToVerify(null);
        }}
        onCancel={() => setCompanyToVerify(null)}
      />

      <ConfirmDialog
        open={companyToDelete !== null}
        title="Excluir empresa"
        message={`Excluir a empresa "${companyToDelete?.company_name}" e todos os seus dados? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={() => void confirmDeleteCompany()}
        onCancel={() => setCompanyToDelete(null)}
      />

      <ConfirmDialog
        open={productToArchive !== null}
        title="Arquivar produto"
        message={`Arquivar o produto "${productToArchive?.product}"? Ele sairá do marketplace e continuará disponível no histórico.`}
        confirmLabel="Arquivar"
        onConfirm={() => void confirmArchiveProduct()}
        onCancel={() => setProductToArchive(null)}
      />
    </div>
  );
}
