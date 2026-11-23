import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Badge, Button, Card, Checkbox, ConfirmDialog, EmptyState, Input, Loader, Pagination, Select, Textarea } from "../../components/ui";
import layout from "../../components/layout/AppLayout/WorkspacePage.module.css";
import { formatCurrency, formatDateTime, formatQuantity } from "../../utils/format";
import {
  evidenceDownload, financeCommand, financeGateway, financeSettings, financeSummary, getFinanceOrder,
  hundredths, listFinanceOrders, listFinancePayouts, message, uploadEvidence, METHOD, ORDER, PAYMENT, PAYOUT, REASONS, REFUND,
  type FinanceOrder, type FinancePayout, type FinanceSettings, type FinanceView,
} from "../../services/finance/financeService";
import styles from "./FinancePage.module.css";

const EMPTY_FILTERS = { status: "", order: "", company: "", from: "", to: "" };
const ID_PATTERN = "[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}";
const VIEWS: Record<FinanceView, string> = { buyer: "Compras", seller: "Vendas", admin: "Gestão financeira" };
const TRACK: Record<string, string> = {
  order_created: "Pedido criado", checkout_started: "Checkout solicitado", payment_processing: "Pagamento em processamento",
  payment_approved: "Pagamento aprovado", payment_declined: "Pagamento recusado", payment_expired: "Pagamento expirado",
  payment_cancelled: "Pagamento cancelado", preparing: "Material em preparação", shipped: "Material enviado",
  received: "Recebimento confirmado", refund_requested: "Reembolso solicitado", refund_review: "Em análise",
  refund_approve: "Reembolso aprovado", refund_reject: "Reembolso recusado", refund_processing: "Estorno enviado ao gateway",
  refund_succeeded: "Estorno confirmado", refund_failed: "O gateway informou falha no estorno",
  refund_cancelled: "Estorno cancelado", payment_refunded: "Pagamento integralmente reembolsado",
  payment_partially_refunded: "Pagamento parcialmente reembolsado", refund_deadline_near: "Prazo perto do vencimento",
  dispute_opened: "Contestação comercial aberta", dispute_closed: "Contestação encerrada",
  dispute_open: "Contestação no gateway", dispute_won: "Contestação aceita pelo gateway",
  dispute_lost: "Contestação perdida no gateway", payment_disputed: "Pagamento em contestação",
};
const MONEY_METRICS = new Set(["gross_cents","commission_cents","net_commission_cents","gateway_fees_cents",
  "refunded_cents","seller_net_cents","payout_paid_cents","payout_pending_cents"]);
const METRICS: Record<FinanceView, [string,string][]> = {
  buyer: [["orders","Compras"],["pending","Aguardando pagamento"],["paid","Pagamentos concluídos"],
    ["awaiting_delivery","Aguardando entrega"],["delivered","Entregues"],["refund_requested","Reembolsos solicitados"],["refund_completed","Reembolsos concluídos"]],
  seller: [["gross_cents","Valor vendido"],["paid","Vendas confirmadas"],["pending","Pagamentos pendentes"],
    ["seller_net_cents","Líquido dos pedidos"],["commission_cents","Comissões"],["gateway_fees_cents","Tarifas"],
    ["payout_paid_cents","Repasses pagos"],["payout_pending_cents","Repasses pendentes"],["refunded_cents","Reembolsos"],["disputes","Disputas abertas"]],
  admin: [["gross_cents","Volume transacionado"],["commission_cents","Comissão bruta"],
    ["net_commission_cents","Comissão após reversões"],["gateway_fees_cents","Tarifas do gateway"],
    ["refunded_cents","Reembolsos"],["payout_paid_cents","Repasses pagos"],["pending","Pagamentos pendentes"],["disputes","Disputas abertas"]],
};
const currencies = new Intl.NumberFormat("pt-BR");
function money(value: number | null) { return value === null ? "A conciliar" : formatCurrency(value / 100); }
function date(value: string) { return formatDateTime(value); }
function valueOf(form: FormData, name: string) { return String(form.get(name) ?? "").trim(); }

type Task = () => Promise<unknown>;
type Confirmation = { title: string; message: string; task: Task };
type Confirm = (title: string, text: string, task: Task) => void;
type EmbeddedSession = { client_secret: string; stripe_account: string; test: boolean };
type CheckoutSession = EmbeddedSession | { url: string };

const stripeAppearance = {
  theme: "stripe", labels: "auto", inputs: "spaced",
  variables: {
    borderRadius: "4px", colorBackground: "#ffffff", colorDanger: "#df1b41", colorPrimary: "#0570de",
    colorSuccess: "#00c853", colorText: "#30313d", fontFamily: "default", fontSizeBase: "16px", spacingUnit: "4px",
  },
} as const;

interface StripePaymentForm {
  mount(container: HTMLElement): void;
  destroy(): void;
  on(event: "ready" | "loaderror", callback: () => void): void;
  on(event: "confirm", callback: (event: unknown) => Promise<void>): void;
}

type StripeFactory = (key: string, options: { stripeAccount: string; locale: "pt-BR" }) => {
  initCheckoutFormSdk(options: { clientSecret: string; appearance: typeof stripeAppearance }): {
    createForm(options: { layout: "expanded" }): StripePaymentForm;
    loadActions(): Promise<{ type: "error" } | { type: "success"; actions: {
      getSession(): { currency: string; total: { total: { amount: string; minorUnitsAmount: number } } };
      confirm(options: { formConfirmEvent: unknown }): Promise<unknown>;
    } }>;
  };
};

export default function FinancePage() {
  const { user, profile, adminMfa } = useAuth();
  const actor = user?.id ?? "";
  const isAdmin = profile?.role === "admin";
  const admin = isAdmin && adminMfa;
  return <FinanceWorkspace key={`${actor}:${admin}`} actor={actor} admin={admin} needsMfa={isAdmin && !admin} />;
}

function FinanceWorkspace({ actor, admin, needsMfa }: { actor: string; admin: boolean; needsMfa: boolean }) {
  const [params, setParams] = useSearchParams();
  const orderId = params.get("pedido");
  const [view, setView] = useState<FinanceView>("buyer");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [orders, setOrders] = useState<FinanceOrder[]>([]);
  const [pages, setPages] = useState(1);
  const [summary, setSummary] = useState<Record<string,number | null> | null>(null);
  const [payouts, setPayouts] = useState<FinancePayout[]>([]);
  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const [confirming, setConfirming] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!actor) return;
    let active = true;
    setLoading(true);
    setListError("");
    Promise.all([
      listFinanceOrders({ ...applied, actor, view, page }),
      financeSummary(view),
      view === "buyer" ? Promise.resolve([]) : listFinancePayouts(view, actor),
      view === "admin" ? financeSettings() : Promise.resolve(null),
    ]).then(([rows, stats, transfers, config]) => {
      if (!active) return;
      setOrders(rows.items);
      setPages(rows.pages);
      setSummary(stats);
      setPayouts(transfers);
      setSettings(config);
    }).catch(() => {
      if (active) setListError("Não foi possível acessar o financeiro. Verifique se as migrações foram aplicadas no ambiente.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [actor, applied, view, page, version]);

  function confirm(title: string, text: string, task: Task) {
    setConfirming({ title, message: text, task });
  }

  async function run(task: Task, notify = true) {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    setConfirming(null);
    try {
      await task();
      if (notify) {
        setVersion((v) => v + 1);
        setFeedback({ text: "Operação registrada.", error: false });
      }
    } catch (e) {
      setFeedback({ text: message(e), error: true });
    } finally {
      setBusy(false);
    }
  }

  function switchView(next: FinanceView) {
    setView(next);
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
    setParams({});
  }

  function filter(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setApplied(filters);
  }

  return <div className={styles.page}>
    <header className={layout.header}>
      <h1 className={layout.title}>Financeiro</h1>
      <p className={layout.subtitle}>Pedidos, pagamentos e comprovantes ligados às negociações da sua empresa.</p>
    </header>
    <nav aria-label="Áreas financeiras" className={styles.actions}>
      {(["buyer", "seller", ...(admin ? ["admin"] : [])] as FinanceView[]).map((key) =>
        <Button key={key} variant={view === key ? "primary" : "outline"} aria-pressed={view === key} onClick={() => switchView(key)}>
          {VIEWS[key]}
        </Button>
      )}
    </nav>
    {needsMfa && (
      <Link to="/admin">Confirmar autenticação em dois fatores para acessar a gestão financeira</Link>
    )}
    {feedback && <p className={styles.feedback} role={feedback.error ? "alert" : "status"}>{feedback.text}</p>}
    {orderId && <OrderDetail key={orderId} id={orderId} actor={actor} admin={admin} busy={busy} version={version} confirm={confirm}
      run={run} />}
    {loading ? <Loader text="Carregando financeiro…" /> : listError ? <EmptyState title={listError}
      action={<Button variant="outline" onClick={() => setVersion((v) => v + 1)}>Tentar novamente</Button>} /> : <>
      {summary && <Card title="Operações em produção">
        <p className={styles.note}>As transações de teste ficam fora dos totais.</p>
        <dl className={styles.facts}>
          {METRICS[view].map(([key, label]) => <div key={key}><dt>{label}</dt>
            <dd>{MONEY_METRICS.has(key) ? money(summary[key]) : currencies.format(summary[key] ?? 0)}</dd>
          </div>)}
        </dl>
      </Card>}
      <Card title={view === "admin" ? "Transações" : view === "seller" ? "Pedidos recebidos" : "Histórico de compras"}>
        <form onSubmit={filter} className={styles.fields}>
          <Input label="ID do pedido" name="order-filter" value={filters.order} onChange={(e) => setFilters({ ...filters, order: e.target.value.trim() })}
            pattern={ID_PATTERN} />
          {view === "admin" && <Input label="Empresa" name="company-filter" value={filters.company} onChange={(e) => setFilters({ ...filters, company: e.target.value })} />}
          <Select label="Pagamento" name="status-filter" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            placeholder="Todos os status" options={Object.entries(PAYMENT).map(([value,label]) => ({ value,label }))} />
          <Input type="date" label="De (UTC)" name="date-from" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          <Input type="date" label="Até (UTC)" name="date-to" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          <Button type="submit" variant="outline">Filtrar pedidos</Button>
        </form>
        {orders.length === 0 ? <EmptyState title="Nenhum pedido encontrado"
          action={view === "buyer" && <Button to="/negociacoes" variant="outline">Ver negociações</Button>} /> :
          <ul className={styles.rows} aria-label="Pedidos">
            {orders.map((o) => <li key={o.id}>
              <div><strong>{o.material}</strong><p>{o.id}</p><p>{o.buyer?.company_name ?? "Comprador"} / {o.seller?.company_name ?? "Vendedor"} · {date(o.created_at)}</p></div>
              <div><strong>{money(o.amount_cents)}</strong><p>{PAYMENT[o.payment_status]}{o.payment_method ? ` · ${METHOD[o.payment_method]}` : ""}</p>
                {o.gateway_live === false && <Badge variant="warning">Teste</Badge>}
              </div>
              <Link to={`?pedido=${o.id}#detalhes-pedido`}>Ver pedido<span className={styles.srOnly}> de {o.material}</span></Link>
            </li>)}
          </ul>}
        <Pagination page={page} totalPages={pages} onChange={setPage} />
      </Card>
      {view !== "buyer" && <Card title="Repasses do gateway">
        <p className={styles.note}>O gateway repassa o saldo da conta conectada. Um repasse pode incluir vendas fora da Rejet Corp.</p>
        {payouts.length === 0 ? <p>Nenhum repasse recebido do gateway.</p> : <ul className={styles.rows} aria-label="Repasses recentes">
          {payouts.map((p) => <li key={`${p.gateway_payout}:${p.gateway_live}`}>
            <div><strong>{money(p.amount_cents)}</strong><p>{p.gateway_payout}{p.arrival_at ? ` · ${date(p.arrival_at)}` : ""}</p>
              {view === "admin" && <p>Empresa {p.seller_id}</p>}</div>
            <Badge variant={p.gateway_live ? "neutral" : "warning"}>{p.gateway_live ? PAYOUT[p.status] : `Teste · ${PAYOUT[p.status]}`}</Badge>
          </li>)}
        </ul>}
      </Card>}
      {view === "admin" && settings && <AdminSettings key={version} settings={settings} confirm={confirm} busy={busy} />}
    </>}
    <ConfirmDialog open={confirming !== null} title={confirming?.title ?? ""} message={confirming?.message ?? ""}
      onConfirm={() => { if (confirming) return run(confirming.task); }} onCancel={() => setConfirming(null)}
      confirmLabel="Confirmar" cancelLabel="Voltar" loading={busy} />
  </div>;
}

function AdminSettings({ settings, confirm, busy }: { settings: FinanceSettings; confirm: Confirm; busy: boolean }) {
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fields = new FormData(e.currentTarget);
    const commission = valueOf(fields,"commission");
    const bps = commission ? hundredths(commission) : null;
    confirm("Salvar política financeira?", "A comissão e a política de reversão passam a valer para novos pedidos.", () => {
      if (commission && (bps === null || bps > 10000)) throw new Error("Informe um percentual entre 0 e 100 com até duas casas.");
      const methods = ["card","pix"].filter((key) => fields.has(key));
      if (!methods.length) throw new Error("Selecione pelo menos um meio de pagamento.");
      return financeCommand("settings", { enabled: fields.has("enabled"), commission_bps: bps,
        methods, reverse_commission: fields.has("reverse") });
    });
  }

  function link(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fields = new FormData(e.currentTarget);
    confirm("Vincular conta Stripe do vendedor?", "Confirme que a conta no painel Stripe pertence à empresa informada.",
      () => financeGateway("link_seller", { company_id: valueOf(fields,"company-id"), account_id: valueOf(fields,"account-id") }));
  }

  return <Card title="Configuração financeira">
    <p className={styles.note}>Pagamentos processados pela Stripe Connect.</p>
    <form onSubmit={save} className={styles.fields}>
      <Input label="Comissão da plataforma (%)" name="commission" inputMode="decimal"
        defaultValue={settings.commission_bps !== null ? (settings.commission_bps / 100).toFixed(2).replace(".",",") : ""} />
      <Checkbox name="enabled" label="Habilitar criação de pedidos" defaultChecked={settings.enabled} />
      <Checkbox name="reverse" label="Reverter comissão proporcional nos estornos" defaultChecked={settings.reverse_commission} />
      <Checkbox name="card" label="Cartão" defaultChecked={settings.methods.includes("card")} />
      <Checkbox name="pix" label="Pix quando habilitado pela Stripe" defaultChecked={settings.methods.includes("pix")} />
      <Button type="submit" disabled={busy}>Salvar política</Button>
    </form>
    <p className={styles.note}>Boleto permanece desabilitado até haver um procedimento de devolução autorizado.</p>
    <form onSubmit={link} className={styles.fields}>
      <Input label="ID da empresa vendedora" name="company-id" required pattern={ID_PATTERN} />
      <Input label="ID da conta conectada Stripe" name="account-id" placeholder="acct_…" required pattern="acct_[a-zA-Z0-9]+" />
      <Button type="submit" variant="outline" disabled={busy}>Vincular vendedor</Button>
    </form>
  </Card>;
}

interface DetailProps {
  id: string; actor: string; admin: boolean; busy: boolean; version: number; confirm: Confirm; run: (task: Task, notify?: boolean) => Promise<void>;
}

function OrderDetail({ id, actor, admin, busy, version, confirm, run }: DetailProps) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getFinanceOrder>> | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [payment, setPayment] = useState<EmbeddedSession | null>(null);
  const detail = useRef<HTMLElement>(null);
  const loaded = data !== null;
  useEffect(() => {
    let active = true;
    setError(false);
    getFinanceOrder(id).then((result) => { if (active) setData(result); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [id,version]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (loaded && window.location.hash === "#detalhes-pedido") {
      detail.current?.focus({ preventScroll: true });
      detail.current?.scrollIntoView({ block: "start" });
    }
  }, [loaded]);
  if (error) return <EmptyState title="Pedido indisponível para consulta" />;
  if (!data) return <Loader text="Carregando pedido…" />;
  const { order: o, refunds, events, disputes } = data;
  const buyer = o.buyer_id === actor;
  const seller = o.seller_id === actor;
  const canFulfil = o.payment_status === "approved" || o.payment_status === "partially_refunded";
  const deadline = o.refund_deadline_at ? new Date(o.refund_deadline_at).getTime() : null;
  const within = deadline !== null && now <= deadline;
  const remaining = Math.max(0, Math.floor(((deadline ?? now) - now) / 60000));
  const openRefund = refunds.some((r) => ["requested","reviewing","approved","processing"].includes(r.status));
  const refundable = ["approved","partially_refunded"].includes(o.payment_status) && !!o.payment_method &&
    o.payment_method !== "boleto" && o.amount_cents > o.refunded_cents && !openRefund;
  const eligible = buyer && within && o.order_status === "delivered" && refundable;
  const company = buyer ? o.seller?.company_name : seller ? o.buyer?.company_name : [o.buyer?.company_name,o.seller?.company_name].filter(Boolean).join(" / ");
  const command = (name: string, payload: Record<string,unknown> = {}) => financeCommand(name, { order_id: o.id, ...payload });
  const canPay = buyer && o.order_status === "awaiting_payment" && (o.payment_status === "pending" || o.payment_status === "declined");

  async function openPayment() {
    const session = await financeGateway<CheckoutSession>("checkout", { order_id: o.id });
    if ("url" in session) {
      const target = new URL(session.url);
      if (target.protocol !== "https:" || target.hostname !== "checkout.stripe.com" || target.username || target.password) {
        throw new Error("Endereço de checkout inválido.");
      }
      window.location.assign(target.href);
      return;
    }
    if (!session.client_secret || !/^acct_[a-zA-Z0-9]+$/.test(session.stripe_account) || typeof session.test !== "boolean") {
      throw new Error("A Stripe não disponibilizou uma sessão de pagamento válida.");
    }
    setPayment(session);
  }
  let sellerNet: number | null = null;
  if (o.gateway_fee_cents !== null && (o.refunded_cents === 0 || o.commission_reversed_cents !== null)) {
    sellerNet = o.amount_cents - o.commission_cents - o.gateway_fee_cents - o.refunded_cents + (o.commission_reversed_cents ?? 0);
  }

  function sendEvidence(e: FormEvent<HTMLFormElement>, mode: "ship" | "refund_request" | "refund_exception") {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("evidence");
    const refund = mode !== "ship";
    confirm(refund ? "Registrar solicitação de reembolso?" : "Informar envio do material?",
      refund ? "A solicitação ficará disponível para análise. O valor só será devolvido após confirmação do gateway."
        : "A empresa compradora será avisada e poderá confirmar o recebimento.", async () => {
        const amount = refund ? (valueOf(form,"refund_type") === "total" ? o.amount_cents - o.refunded_cents : hundredths(valueOf(form,"amount"))) : null;
        if (refund && (amount === null || amount <= 0 || amount > o.amount_cents - o.refunded_cents)) throw new Error("Informe um valor dentro do saldo reembolsável.");
        const path = file instanceof File && file.size ? await uploadEvidence(o.id,actor,file) : null;
        return command(mode, refund ? { amount_cents: amount, reason: valueOf(form,"reason"),
          description: valueOf(form,"description"), evidence_path: path } : { tracking: valueOf(form,"tracking"), evidence_path: path });
      });
  }

  return <section id="detalhes-pedido" ref={detail} tabIndex={-1} className={styles.page} aria-label="Detalhes do pedido">
    <Card title={o.material}>
      {company && <p className={styles.note}>{company}</p>}
      <div className={styles.actions}>
        <Badge variant={o.gateway_live === false ? "warning" : "neutral"}>{o.gateway_live === false ? "Pagamento de teste" : PAYMENT[o.payment_status]}</Badge>
        <Badge variant="secondary">{ORDER[o.order_status]}</Badge>
      </div>
      <dl className={styles.facts}>
        <div><dt>Pedido</dt><dd>{o.id}</dd></div>
        <div><dt>Quantidade</dt><dd>{formatQuantity(o.quantity,o.unit)}</dd></div>
        <div><dt>Total do pedido</dt><dd>{money(o.amount_cents)}</dd></div>
        <div><dt>Pagamento</dt><dd>{PAYMENT[o.payment_status]}{o.payment_method && ` · ${METHOD[o.payment_method]}`}</dd></div>
        <div><dt>Comissão aplicada</dt><dd>{money(o.commission_cents)} · {currencies.format(o.commission_bps / 100)}%</dd></div>
        {(!buyer || admin) && <><div><dt>Tarifa do gateway</dt><dd>{money(o.gateway_fee_cents)}</dd></div>
          <div><dt>Valor líquido do pedido</dt><dd>{money(sellerNet)}</dd></div></>}
        <div><dt>Reembolsado</dt><dd>{money(o.refunded_cents)}</dd></div>
        {o.received_at && <div><dt>Recebimento</dt><dd>{date(o.received_at)}</dd></div>}
        {o.tracking && <div><dt>Transporte</dt><dd>{o.tracking}</dd></div>}
      </dl>
      <div className={styles.actions}>
        <Button to={`/negociacoes/${o.negotiation_id}`} variant="ghost">Abrir negociação</Button>
        {canPay && <Button id="abrir-pagamento" disabled={busy || payment !== null}
          onClick={() => void run(openPayment, false)}>Abrir pagamento</Button>}
        {o.gateway_session && (buyer || seller || admin) && <Button variant="outline" disabled={busy}
          onClick={() => void run(() => financeGateway("reconcile",{order_id:o.id}))}>Consultar gateway</Button>}
        {seller && o.order_status === "paid" && canFulfil &&
          <Button disabled={busy} onClick={() => void run(() => command("prepare"))}>Iniciar preparação</Button>}
        {buyer && o.order_status === "shipped" && canFulfil && <Button disabled={busy}
          onClick={() => confirm("Confirmar recebimento?", "Confirme após verificar o material. A confirmação inicia o prazo comercial de 7 dias.", () => command("receive"))}>
          Confirmar recebimento
        </Button>}
        {o.shipment_evidence && <Button variant="outline" onClick={() => void run(() => evidenceDownload(o.shipment_evidence!))}>Baixar comprovante de envio</Button>}
      </div>
    </Card>

    {canPay && payment && <EmbeddedPayment session={payment} amountCents={o.amount_cents} onClose={() => {
      setPayment(null);
      requestAnimationFrame(() => document.getElementById("abrir-pagamento")?.focus());
    }} />}

    {seller && canFulfil && ["paid","preparing"].includes(o.order_status) && <Card title="Registrar envio">
      <form className={styles.fields} onSubmit={(e) => sendEvidence(e,"ship")}>
        <Input label="Transporte ou código de rastreio" name="tracking" maxLength={300} />
        <Input label="Comprovante opcional" name="evidence" type="file" accept=".pdf,.jpg,.jpeg,.png" />
        <Button type="submit" disabled={busy}>Informar envio</Button>
      </form>
    </Card>}

    <Card title="Reembolsos e entrega">
      {o.refund_deadline_at ? <p>Prazo comercial até <strong>{date(o.refund_deadline_at)}</strong>. {within
        ? `${Math.floor(remaining / 1440)} d ${Math.floor(remaining / 60) % 24} h ${remaining % 60} min restantes.`
        : "O prazo comercial terminou. Reclamações e exceções aplicáveis continuam disponíveis."}</p>
        : <p>O prazo comercial começa após o comprador confirmar o recebimento.</p>}
      {eligible && <RefundFields onSubmit={(e) => sendEvidence(e,"refund_request")} balance={o.amount_cents-o.refunded_cents} busy={busy} />}
      {admin && refundable && !eligible && <details><summary>Registrar exceção administrativa</summary>
        <RefundFields onSubmit={(e) => sendEvidence(e,"refund_exception")} balance={o.amount_cents-o.refunded_cents} busy={busy} />
      </details>}
      {refunds.length > 0 && <ul className={styles.rows} aria-label="Solicitações de reembolso">{refunds.map((r) =>
        <li key={r.id} className={styles.stacked}>
          <div><strong>{REFUND[r.status]} · {money(r.amount_cents)}</strong>
            <p>{REASONS[r.reason]} · {date(r.created_at)}</p><p>{r.description}</p>{r.decision && <p>Justificativa: {r.decision}</p>}
          </div>
          {r.evidence_path && <Button variant="outline" onClick={() => void run(() => evidenceDownload(r.evidence_path!))}>Baixar anexo</Button>}
          {admin && ["requested","reviewing"].includes(r.status) && <form className={styles.fields} onSubmit={(e) => {
            e.preventDefault();
            const fields = new FormData(e.currentTarget);
            const action = valueOf(fields,"decision");
            confirm("Registrar decisão sobre o reembolso?", "A justificativa será registrada. Aprovar uma solicitação permite iniciar o estorno.",
              () => command(action,{ refund_id: r.id, description: valueOf(fields,"justification") }));
          }}>
            <Textarea name="justification" label="Justificativa da decisão" maxLength={2000} required />
            <Select name="decision" label="Decisão" options={[
              {value:"refund_review",label:"Em análise"},{value:"refund_approve",label:"Aprovar"},{value:"refund_reject",label:"Recusar"},
            ]} />
            <Button type="submit" disabled={busy}>Registrar decisão</Button>
          </form>}
          {admin && ["approved","processing"].includes(r.status) && <Button variant="outline" disabled={busy}
            onClick={() => confirm("Processar estorno no gateway?", "O pedido e o saldo serão revalidados antes de enviar o estorno.",
              () => financeGateway("refund",{order_id:o.id,refund_id:r.id}))}>Processar ou consultar estorno</Button>}
        </li>)}</ul>}
    </Card>

    <Card title="Contestações">
      {buyer && o.paid_at && !disputes.some((d) => d.status === "open" && !d.gateway_dispute) &&
        <form className={styles.fields} onSubmit={(e) => {
          e.preventDefault();
          const description = valueOf(new FormData(e.currentTarget),"description");
          confirm("Abrir contestação?", "A equipe administrativa será avisada para analisar o caso.", () => command("dispute_open",{description}));
        }}>
          <Textarea id="dispute-description" name="description" label="Descreva o problema" required maxLength={2000} />
          <Button type="submit" variant="outline" disabled={busy}>Abrir contestação</Button>
        </form>}
      {disputes.length === 0 ? <p>Nenhuma contestação registrada.</p> : <ul className={styles.rows} aria-label="Contestações">{disputes.map((d) =>
        <li key={d.id} className={styles.stacked}><strong>{d.gateway_dispute ? "Gateway" : "Entrega"} · {d.status === "open" ? "Aberta" : "Analisada"}</strong>
          <p>{d.description}</p>{d.resolution && <p>{d.resolution}</p>}
          {admin && d.status === "open" && !d.gateway_dispute && <form className={styles.fields} onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            confirm("Encerrar contestação?", "A decisão ficará registrada no histórico.", () => command("dispute_close",
              { description:valueOf(form,"resolution"), restore:valueOf(form,"restore") }));
          }}>
            <Textarea name="resolution" label="Justificativa da decisão" required maxLength={2000} />
            <Select name="restore" label="Situação do pedido" options={(o.received_at ? ["delivered","cancelled"] as const
              : ["shipped","preparing","paid","cancelled"] as const).map((value) => ({value,label:ORDER[value]}))} />
            <Button type="submit" disabled={busy}>Encerrar contestação</Button>
          </form>}
        </li>)}</ul>}
    </Card>
    <Card title="Histórico do pedido">
      {events.length === 0 ? <p>Nenhum evento registrado.</p> : <ol className={styles.rows}>
        {events.map((event) => <li key={event.id}><strong>{TRACK[event.kind] ?? "Atualização recebida do gateway"}</strong><time dateTime={event.created_at}>{date(event.created_at)}</time></li>)}
      </ol>}
    </Card>
  </section>;
}

function EmbeddedPayment({ session, amountCents, onClose }: { session: EmbeddedSession; amountCents: number; onClose: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    heading.current?.focus();
    const mountPoint = container.current;
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
    const stripe = (window as Window & { Stripe?: StripeFactory }).Stripe;
    let form: StripePaymentForm | undefined;
    let active = true;

    function fail(text: string) {
      if (!active) return;
      setLoading(false);
      setError(text);
    }

    async function mount() {
      if (!mountPoint || !stripe) throw new Error("Stripe.js indisponível");
      if (!key?.startsWith(session.test ? "pk_test_" : "pk_live_")) {
        fail("O pagamento está indisponível. Peça ao suporte para verificar a configuração da Stripe.");
        return;
      }
      const checkout = stripe(key, { stripeAccount: session.stripe_account, locale: "pt-BR" }).initCheckoutFormSdk({
        clientSecret: session.client_secret, appearance: stripeAppearance,
      });
      const result = await checkout.loadActions();
      if (!active) return;
      if (result.type === "error") throw new Error("Sessão Stripe indisponível");
      const current = result.actions.getSession();
      if (current.currency.toLowerCase() !== "brl" || current.total.total.minorUnitsAmount !== amountCents) {
        fail("O total da Stripe diverge do pedido. Consulte o suporte antes de pagar.");
        return;
      }
      setTotal(current.total.total.amount);
      form = checkout.createForm({ layout: "expanded" });
      form.on("ready", () => { if (active) setLoading(false); });
      form.on("loaderror", () => fail("Não foi possível carregar o formulário. Feche e tente abrir o pagamento novamente."));
      form.on("confirm", async (event) => {
        if (!active) return;
        setError("");
        try {
          await result.actions.confirm({ formConfirmEvent: event });
        } catch {
          fail("Não foi possível confirmar o pagamento. Consulte o status do pedido antes de tentar novamente.");
        }
      });
      form.mount(mountPoint);
    }

    queueMicrotask(() => {
      if (active) void mount().catch(() => fail("Não foi possível carregar o formulário. Feche e tente abrir o pagamento novamente."));
    });
    return () => { active = false; form?.destroy(); };
  }, [amountCents, session]);

  return <Card>
    <h2 ref={heading} tabIndex={-1} className={styles.paymentHeading}>Pagamento do pedido</h2>
    {session.test && <p className={styles.note}>Ambiente de teste</p>}
    {total && <p className={styles.note}>Total {total}</p>}
    {loading && <p role="status">Carregando formulário da Stripe…</p>}
    {error && <p role="alert" className={styles.feedback}>{error}</p>}
    <div id="checkout-form" ref={container} />
    <div className={styles.actions}><Button variant="outline" onClick={onClose}>Fechar pagamento</Button></div>
  </Card>;
}

function RefundFields({ onSubmit, balance, busy }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; balance: number; busy: boolean }) {
  const [kind, setKind] = useState("total");
  return <form className={styles.fields} onSubmit={onSubmit}>
    <p>Saldo reembolsável {money(balance)}</p>
    <Select label="Tipo de reembolso" name="refund_type" value={kind} onChange={(e) => setKind(e.target.value)}
      options={[{value:"total",label:"Total do saldo"},{value:"partial",label:"Parcial"}]} />
    {kind === "partial" && <Input name="amount" label="Valor solicitado (R$)" inputMode="decimal" required />}
    <Select label="Motivo" name="reason" options={Object.entries(REASONS).map(([value,label]) => ({value,label}))} />
    <Textarea id="refund-description" label="Descrição ou justificativa da exceção" name="description" required maxLength={2000} />
    <Input label="Anexo opcional" name="evidence" type="file" accept=".pdf,.jpg,.jpeg,.png" />
    <Button type="submit" disabled={busy}>Solicitar reembolso</Button>
  </form>;
}
