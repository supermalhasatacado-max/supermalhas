"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Ticket,
  Settings,
  Truck,
  FileText,
  CreditCard,
  MessageSquare,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Pencil,
  X,
  Check,
  Search,
  Download,
  RefreshCw,
  Mail,
  LogOut,
  Globe,
  AlertCircle,
  TrendingUp,
  BarChart3,
  Users,
  Eye,
} from "lucide-react";
import { useShop, api } from "./context";
import {
  Button,
  LinkButton,
  Field,
  ErrorBox,
  Modal,
  Empty,
  GradeSummary,
} from "./ui";
import {
  money,
  date,
  paymentLabels,
  fulfillmentLabels,
} from "@/lib/shop/types";
import type {
  Product,
  StoreSettings,
  Order,
  ShippingRule,
} from "@/lib/shop/types";
import { states } from "@/lib/shop/validation";
type Coupon = {
  code: string;
  kind: string;
  value: number;
  minimum: number;
  usage_limit: number;
  used: number;
  active: number;
  expires_at: string | null;
};
type Dashboard = {
  products: Product[];
  orders: Order[];
  coupons: Coupon[];
  contacts: {
    id: string;
    name: string;
    email: string;
    message: string;
    status: string;
    created_at: string;
  }[];
  subscribers: { email: string; active: number; created_at: string }[];
  settings: StoreSettings;
};
const menu = [
  { slug: "", title: "Visão geral", icon: LayoutDashboard },
  { slug: "pedidos", title: "Pedidos", icon: ShoppingBag },
  { slug: "produtos", title: "Produtos e estoque", icon: Package },
  { slug: "cupons", title: "Cupons", icon: Ticket },
  { slug: "empresa", title: "Dados da empresa", icon: Settings },
  { slug: "entrega", title: "Frete e entrega", icon: Truck },
  { slug: "politicas", title: "Políticas e conteúdo", icon: FileText },
  { slug: "pagamentos", title: "Pagamentos", icon: CreditCard },
  { slug: "mensagens", title: "Atendimento", icon: MessageSquare },
  { slug: "lancamento", title: "Preparar lançamento", icon: Globe },
];
function exportCsv(filename: string, rows: unknown[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((v) => {
          let s = String(v ?? "");
          if (/^[=+@-]/.test(s)) s = "'" + s;
          return '"' + s.replaceAll('"', '""') + '"';
        })
        .join(";"),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
export function AdminPage() {
  const { data, loading: bootstrapLoading, refresh, toast } = useShop(),
    path = usePathname(),
    router = useRouter(),
    section = path.split("/")[2] || "";
  const [dashboard, setDashboard] = useState<Dashboard | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [settings, setSettings] = useState<StoreSettings>(data.settings),
    [saving, setSaving] = useState(false),
    [query, setQuery] = useState(""),
    [statusFilter, setStatusFilter] = useState("all"),
    [product, setProduct] = useState<Product | null>(null),
    [coupon, setCoupon] = useState<Coupon | null>(null),
    [order, setOrder] = useState<Order | null>(null),
    [rule, setRule] = useState<ShippingRule | null>(null);
  const load = async () => {
    setError("");
    try {
      const d = await api<Dashboard>("admin/dashboard");
      setDashboard(d);
      setSettings(d.settings);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (data.admin) load();
  }, [data.admin]);
  const saveSettings = async () => {
    setSaving(true);
    setError("");
    try {
      const s = await api<StoreSettings>("admin/settings", settings);
      setSettings(s);
      await refresh();
      toast("Configurações salvas.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const closeProduct = useCallback(() => setProduct(null), []),
    closeCoupon = useCallback(() => setCoupon(null), []),
    closeOrder = useCallback(() => setOrder(null), []),
    closeRule = useCallback(() => setRule(null), []);
  if (bootstrapLoading)
    return (
      <div className="container section">
        <p>Verificando acesso…</p>
      </div>
    );
  if (!data.admin)
    return (
      <div className="admin-access">
        <img className="admin-access-logo" src="/images/logo.png" alt="Super Malhas Atacado" width={1226} height={1283} />
        <h1>Painel da Super Malhas.</h1>
        <p>Acesse com a conta autorizada para administrar a loja.</p>
        <a
          href="/entrar?return_to=/admin"
          target="_top"
          className="btn primary"
        >
          Entrar na administração <ArrowRight size={18} />
        </a>
        {data.user && (
          <ErrorBox message="Essa conta não tem acesso administrativo." />
        )}
        <Link href="/" className="text-link">
          Voltar à loja
        </Link>
      </div>
    );
  const selected = menu.find((m) => m.slug === section) || menu[0],
    d = dashboard,
    paid =
      d?.orders.filter(
        (o) => !o.demo && !o.sandbox && o.payment_status === "paid",
      ) || [],
    revenue = paid.reduce((n, o) => n + o.total, 0),
    orders =
      d?.orders.filter(
        (o) =>
          (statusFilter === "all" ||
            (statusFilter === "demo" && !!o.demo) ||
            o.payment_status === statusFilter) &&
          `${o.number} ${o.customer.name} ${o.customer.email}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ) || [];
  const set = (key: keyof StoreSettings, value: any) =>
    setSettings((s) => ({ ...s, [key]: value }));
  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <Link href="/admin" className="admin-brand">
          <img src="/images/logo.png" alt="Super Malhas Atacado" width={1226} height={1283} />
          <small>ADMINISTRAÇÃO</small>
        </Link>
        <div className="admin-store-status">
          <i className={settings.salesEnabled ? "live" : ""} />
          {settings.salesEnabled ? "Loja em operação" : "Em pré-lançamento"}
        </div>
        <label className="admin-mobile-menu">
          Área do painel
          <select
            aria-label="Área do painel"
            value={section}
            onChange={(e) =>
              router.push(`/admin${e.target.value ? "/" + e.target.value : ""}`)
            }
          >
            {menu.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.title}
              </option>
            ))}
          </select>
        </label>
        <nav aria-label="Administração">
          {menu.map(({ slug, title, icon: Icon }) => (
            <Link
              href={`/admin${slug ? "/" + slug : ""}`}
              className={section === slug ? "active" : ""}
              key={slug}
            >
              <Icon size={19} />
              {title}
              {slug === "mensagens" &&
                !!d?.contacts.filter((c) => c.status === "new").length && (
                  <b>{d.contacts.filter((c) => c.status === "new").length}</b>
                )}
            </Link>
          ))}
        </nav>
        <Link href="/" className="admin-view-store">
          <Eye size={17} />
          Visualizar loja
          <ArrowUpRight size={15} />
        </Link>
        <small>{data.user?.email}</small>
      </aside>
      <div className="admin-main">
        <header className="admin-top">
          <div>
            <span>SUPER MALHAS ATACADO</span>
            <h1>{selected.title}</h1>
          </div>
          <div>
            <Link href="/" className="btn outline">
              <ArrowUpRight size={16} />
              Ver loja
            </Link>
            <span className="admin-avatar">
              {data.user?.displayName[0]?.toUpperCase()}
            </span>
          </div>
        </header>
        <main className="admin-content" id="conteudo">
          <ErrorBox message={error} />
          {loading ? (
            <p>Carregando sua operação…</p>
          ) : d ? (
            <>
              {section === "" && (
                <>
                  <div className="admin-welcome">
                    <span>
                      <span className="eyebrow">
                        <i />
                        SEU NEGÓCIO, EM SUAS MÃOS
                      </span>
                      <h2>Vamos fazer sua loja crescer.</h2>
                      <p>
                        Produtos, pedidos e configurações da Super Malhas em um
                        só lugar.
                      </p>
                    </span>
                    <Package size={65} strokeWidth={1} />
                  </div>
                  <div className="metric-grid">
                    {[
                      {
                        title: "Receita aprovada",
                        value: money(revenue),
                        icon: TrendingUp,
                        sub: "Pedidos reais com pagamento aprovado",
                      },
                      {
                        title: "Pedidos",
                        value: d.orders.filter((o) => !o.demo && !o.sandbox)
                          .length,
                        icon: ShoppingBag,
                        sub: `${d.orders.filter((o) => !!o.demo).length} pedidos demonstrativos separados`,
                      },
                      {
                        title: "Pacotes disponíveis",
                        value: d.products.reduce((n, p) => n + p.stock, 0),
                        icon: Package,
                        sub: "Estoque disponível para novas vendas",
                      },
                      {
                        title: "Mensagens pendentes",
                        value: d.contacts.filter((c) => c.status === "new")
                          .length,
                        icon: MessageSquare,
                        sub: "Solicitações na central de atendimento",
                      },
                    ].map(({ title, value, icon: Icon, sub }) => (
                      <div className="metric-card" key={title}>
                        <span>
                          {title}
                          <Icon size={19} />
                        </span>
                        <b>{value}</b>
                        <small>{sub}</small>
                      </div>
                    ))}
                  </div>
                  {data.launchIssues.length > 0 && (
                    <div className="launch-callout">
                      <span>
                        <Globe size={27} />
                        <div>
                          <h3>O próximo passo é preparar o lançamento.</h3>
                          <p>
                            {data.launchIssues.length} configurações pendentes
                            para habilitar vendas.
                          </p>
                        </div>
                      </span>
                      <LinkButton href="/admin/lancamento">
                        Ver pendências
                        <ArrowRight size={17} />
                      </LinkButton>
                    </div>
                  )}
                  <div className="admin-panel">
                    <div className="admin-panel-heading">
                      <h3>Pedidos recentes</h3>
                      <Link href="/admin/pedidos" className="text-link">
                        Todos os pedidos
                        <ArrowRight size={15} />
                      </Link>
                    </div>
                    {d.orders.length ? (
                      <OrdersTable
                        orders={d.orders.slice(0, 6)}
                        onClick={(o) =>
                          api<Order>(`admin/orders/${o.id}`)
                            .then(setOrder)
                            .catch((e) => setError(e.message))
                        }
                      />
                    ) : (
                      <Empty title="Sua operação começa aqui.">
                        <p>
                          Faça um pedido demonstrativo para testar o fluxo
                          completo.
                        </p>
                        <LinkButton href="/camisetas" variant="outline">
                          Testar a loja
                        </LinkButton>
                      </Empty>
                    )}
                  </div>
                  <div className="admin-panel">
                    <h3>Estoque de pacotes</h3>
                    <div className="stock-overview">
                      {d.products.map((p) => (
                        <div key={p.id}>
                          <img src={p.image} alt="Camisetas" />
                          <span>
                            <b>{p.title}</b>
                            <small>
                              {p.pieces} peças · {money(p.price)}
                            </small>
                          </span>
                          <strong>
                            {p.stock}
                            <small>pacotes</small>
                          </strong>
                          <button
                            className="btn outline"
                            onClick={() => setProduct(p)}
                          >
                            Gerenciar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {section === "pedidos" && (
                <div className="admin-panel">
                  <div className="admin-panel-heading">
                    <div>
                      <h2>Todos os pedidos</h2>
                      <p>Consulte pagamentos, separação e entrega.</p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() =>
                        exportCsv("super-malhas-pedidos.csv", [
                          [
                            "Pedido",
                            "Data",
                            "Cliente",
                            "E-mail",
                            "Tipo",
                            "Pagamento",
                            "Entrega",
                            "Total (R$)",
                          ],
                          ...orders.map((o) => [
                            o.number,
                            o.created_at,
                            o.customer.name,
                            o.customer.email,
                            o.demo
                              ? "Demonstrativo"
                              : o.sandbox
                                ? "Sandbox Pagar.me"
                                : "Real",
                            o.payment_status,
                            o.fulfillment,
                            (o.total / 100).toFixed(2),
                          ]),
                        ])
                      }
                    >
                      <Download size={16} />
                      Exportar
                    </Button>
                  </div>
                  <div className="admin-toolbar">
                    <div className="admin-search">
                      <Search size={18} />
                      <input
                        placeholder="Buscar pedido, nome ou e-mail"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                    <select
                      aria-label="Filtrar pedidos"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="all">Todos os pedidos</option>
                      <option value="pending">Aguardando pagamento</option>
                      <option value="paid">Pagamento aprovado</option>
                      <option value="failed">Pagamento recusado</option>
                      <option value="refunded">Estornados</option>
                      <option value="demo">Demonstrativos</option>
                    </select>
                  </div>
                  {orders.length ? (
                    <OrdersTable
                      orders={orders}
                      onClick={(o) =>
                        api<Order>(`admin/orders/${o.id}`)
                          .then(setOrder)
                          .catch((e) => setError(e.message))
                      }
                    />
                  ) : (
                    <Empty title="Nenhum pedido encontrado">
                      <p>
                        Os pedidos aparecerão aqui conforme a loja for
                        utilizada.
                      </p>
                    </Empty>
                  )}
                </div>
              )}
              {section === "produtos" && (
                <div className="admin-panel">
                  <div className="admin-panel-heading">
                    <div>
                      <h2>Produtos e estoque</h2>
                      <p>
                        O estoque é contado em pacotes. Pedidos reais reservam
                        pacotes automaticamente.
                      </p>
                    </div>
                    <Button
                      onClick={() =>
                        setProduct({
                          id: `sm-${Date.now()}`,
                          slug: "",
                          title: "",
                          pieces: 200,
                          price: 500000,
                          stock: 0,
                          active: 1,
                          featured: 0,
                          description: "",
                          image: "/images/camisetas.png",
                          specs: {
                            Material: "Malha peruana",
                            Cor: "Branco",
                            Tamanhos: "P, M, G e GG",
                          },
                        })
                      }
                    >
                      <Plus size={17} />
                      Novo produto
                    </Button>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Produto</th>
                          <th>Preço do pacote</th>
                          <th>Estoque</th>
                          <th>Status</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {d.products.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <span className="table-product">
                                <img src={p.image} alt="Camisetas" />
                                <span>
                                  <b>{p.title}</b>
                                  <small>
                                    {p.pieces} peças · {p.id}
                                  </small>
                                </span>
                              </span>
                            </td>
                            <td>{money(p.price)}</td>
                            <td>
                              <b>{p.stock}</b> pacotes
                            </td>
                            <td>
                              <span
                                className={`status-pill ${p.active ? "paid" : "canceled"}`}
                              >
                                {p.active ? "Publicado" : "Oculto"}
                              </span>
                            </td>
                            <td>
                              <Button
                                variant="outline"
                                onClick={() => setProduct(p)}
                              >
                                <Pencil size={15} />
                                Editar
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {section === "cupons" && (
                <div className="admin-panel">
                  <div className="admin-panel-heading">
                    <div>
                      <h2>Cupons e condições especiais</h2>
                      <p>Defina descontos, validade e limite de uso.</p>
                    </div>
                    <Button
                      onClick={() =>
                        setCoupon({
                          code: "",
                          kind: "percent",
                          value: 5,
                          minimum: 0,
                          usage_limit: 100,
                          used: 0,
                          active: 1,
                          expires_at: null,
                        })
                      }
                    >
                      <Plus size={17} />
                      Criar cupom
                    </Button>
                  </div>
                  {d.coupons.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Cupom</th>
                            <th>Desconto</th>
                            <th>Compra mínima</th>
                            <th>Usos</th>
                            <th>Status</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {d.coupons.map((c) => (
                            <tr key={c.code}>
                              <td>
                                <b>{c.code}</b>
                              </td>
                              <td>
                                {c.kind === "percent"
                                  ? `${c.value}%`
                                  : money(c.value)}
                              </td>
                              <td>{money(c.minimum)}</td>
                              <td>
                                {c.used} / {c.usage_limit}
                              </td>
                              <td>{c.active ? "Ativo" : "Inativo"}</td>
                              <td>
                                <Button
                                  variant="outline"
                                  onClick={() => setCoupon(c)}
                                >
                                  Editar
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty
                      icon={Ticket}
                      title="Crie uma boa condição de compra."
                    >
                      <p>Nenhum cupom cadastrado.</p>
                    </Empty>
                  )}
                </div>
              )}
              {section === "empresa" && (
                <div className="admin-panel settings-panel">
                  <h2>Informações da empresa</h2>
                  <p>Dados fiscais, endereço e canais de atendimento.</p>
                  <div className="form-grid">
                    <AdminInput
                      label="Nome da loja"
                      value={settings.storeName}
                      onChange={(v) => set("storeName", v)}
                    />
                    <AdminInput
                      label="Razão social"
                      value={settings.legalName}
                      onChange={(v) => set("legalName", v)}
                    />
                    <AdminInput
                      label="CNPJ"
                      value={settings.cnpj}
                      onChange={(v) => set("cnpj", v)}
                    />
                    <AdminInput
                      label="E-mail fiscal"
                      type="email"
                      value={settings.fiscalEmail}
                      onChange={(v) => set("fiscalEmail", v)}
                      hint="Uso administrativo; não é exibido como atendimento."
                    />
                    <AdminInput
                      label="E-mail de atendimento"
                      type="email"
                      value={settings.email}
                      onChange={(v) => set("email", v)}
                    />
                    <AdminInput
                      label="Telefone fixo"
                      value={settings.phone}
                      onChange={(v) => set("phone", v)}
                    />
                    <AdminInput
                      label="WhatsApp com DDD"
                      value={settings.whatsapp}
                      onChange={(v) => set("whatsapp", v)}
                      hint="Preencha apenas se o número tiver WhatsApp."
                    />
                    <AdminInput
                      label="Horário de atendimento"
                      value={settings.businessHours}
                      onChange={(v) => set("businessHours", v)}
                      placeholder="Segunda a sexta, das 9h às 18h"
                    />
                    <AdminInput
                      label="CEP de origem"
                      value={settings.originZip}
                      onChange={(v) => set("originZip", v)}
                    />
                    <Field label="Endereço completo" className="span-all">
                      <textarea
                        rows={2}
                        value={settings.address}
                        onChange={(e) => set("address", e.target.value)}
                      />
                    </Field>
                  </div>
                  <SaveSettings busy={saving} onClick={saveSettings} />
                </div>
              )}
              {section === "entrega" && (
                <>
                  <div className="admin-panel">
                    <div className="admin-panel-heading">
                      <div>
                        <h2>Regras de frete</h2>
                        <p>
                          Cadastre valores fixos por estado, prazos e condições
                          de frete grátis.
                        </p>
                      </div>
                      <Button
                        onClick={() =>
                          setRule({
                            id: `entrega-${Date.now()}`,
                            label: "",
                            states: [],
                            amount: 0,
                            freeAbove: 0,
                            minDays: 5,
                            maxDays: 10,
                            active: true,
                          })
                        }
                      >
                        <Plus size={17} />
                        Nova regra
                      </Button>
                    </div>
                    <div className="notice">
                      <p>
                        Os valores cadastrados serão cobrados no checkout. A
                        operação usa uma tabela de frete definida pela loja;
                        cadastre os valores negociados com sua transportadora.
                      </p>
                    </div>
                    {settings.shippingRules.length ? (
                      <div className="shipping-rules">
                        {settings.shippingRules.map((r) => (
                          <div key={r.id}>
                            <Truck size={24} />
                            <span>
                              <b>{r.label}</b>
                              <small>
                                {r.states.length
                                  ? r.states.join(", ")
                                  : "Todos os estados"}{" "}
                                · {r.minDays} a {r.maxDays} dias úteis
                              </small>
                              <small>
                                {r.freeAbove > 0
                                  ? `Grátis a partir de ${money(r.freeAbove)}`
                                  : "Sem condição de frete grátis"}{" "}
                                · {r.active ? "Ativa" : "Inativa"}
                              </small>
                            </span>
                            <b>{money(r.amount)}</b>
                            <Button
                              variant="outline"
                              onClick={() => setRule(r)}
                            >
                              <Pencil size={15} />
                              Editar
                            </Button>
                            <button
                              className="icon-button"
                              onClick={() =>
                                set(
                                  "shippingRules",
                                  settings.shippingRules.filter(
                                    (x) => x.id !== r.id,
                                  ),
                                )
                              }
                              aria-label={`Excluir regra ${r.label}`}
                            >
                              <X size={18} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Empty icon={Truck} title="Vamos preparar suas entregas.">
                        <p>Cadastre ao menos uma regra para ativar vendas.</p>
                      </Empty>
                    )}
                    <SaveSettings busy={saving} onClick={saveSettings} />
                  </div>
                  <div className="admin-panel settings-panel">
                    <h2>Tabela de medidas</h2>
                    <p>Publique medidas reais dos produtos em centímetros.</p>
                    {settings.sizeChart.map((row, i) => (
                      <div className="size-chart-row" key={i}>
                        <AdminInput
                          label="Tamanho"
                          value={row.size}
                          onChange={(v) =>
                            set(
                              "sizeChart",
                              settings.sizeChart.map((x, n) =>
                                n === i ? { ...x, size: v } : x,
                              ),
                            )
                          }
                        />
                        <AdminInput
                          label="Largura (cm)"
                          value={row.width}
                          onChange={(v) =>
                            set(
                              "sizeChart",
                              settings.sizeChart.map((x, n) =>
                                n === i ? { ...x, width: v } : x,
                              ),
                            )
                          }
                        />
                        <AdminInput
                          label="Comprimento (cm)"
                          value={row.height}
                          onChange={(v) =>
                            set(
                              "sizeChart",
                              settings.sizeChart.map((x, n) =>
                                n === i ? { ...x, height: v } : x,
                              ),
                            )
                          }
                        />
                        <button
                          className="icon-button"
                          aria-label="Remover tamanho"
                          onClick={() =>
                            set(
                              "sizeChart",
                              settings.sizeChart.filter((_, n) => n !== i),
                            )
                          }
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      onClick={() =>
                        set("sizeChart", [
                          ...settings.sizeChart,
                          { size: "", width: "", height: "" },
                        ])
                      }
                    >
                      <Plus size={16} />
                      Adicionar tamanho
                    </Button>
                    <SaveSettings busy={saving} onClick={saveSettings} />
                  </div>
                </>
              )}
              {section === "politicas" && (
                <div className="admin-panel settings-panel">
                  <h2>Conteúdo da loja</h2>
                  <p>
                    As páginas públicas exibem os textos salvos aqui. Os campos
                    aceitam texto simples.
                  </p>
                  {(
                    [
                      { key: "about", label: "Sobre a Super Malhas" },
                      {
                        key: "shippingPolicy",
                        label: "Política de envio e entrega",
                      },
                      { key: "returnPolicy", label: "Trocas e devoluções" },
                      {
                        key: "privacyPolicy",
                        label: "Política de privacidade",
                      },
                      { key: "terms", label: "Termos de compra" },
                    ] as const
                  ).map(({ key, label }) => (
                    <Field label={label} key={key}>
                      <textarea
                        rows={7}
                        value={settings[key]}
                        onChange={(e) => set(key, e.target.value)}
                        placeholder="Escreva o texto oficial da loja…"
                      />
                    </Field>
                  ))}
                  <SaveSettings busy={saving} onClick={saveSettings} />
                </div>
              )}
              {section === "pagamentos" && (
                <>
                  <div className="admin-panel settings-panel">
                    <div className="admin-panel-heading">
                      <div>
                        <h2>Integração Pagar.me</h2>
                        <p>Pix, boleto e cartão com checkout hospedado.</p>
                      </div>
                      <span
                        className={`status-pill ${data.paymentReady ? "paid" : "pending"}`}
                      >
                        {data.paymentReady
                          ? "Chave configurada"
                          : "Aguardando chave"}
                      </span>
                    </div>
                    <div className="integration-info">
                      <CreditCard size={30} />
                      <div>
                        <b>
                          Ambiente:{" "}
                          {data.paymentEnvironment === "test"
                            ? "Teste (sandbox)"
                            : "Produção"}
                        </b>
                        <p>
                          A chave secreta é configurada no ambiente do servidor
                          como PAGARME_SECRET_KEY. Ela não aparece no navegador
                          nem no código publicado.
                        </p>
                      </div>
                    </div>
                    <Field label="Endpoint para notificações Pagar.me">
                      <input
                        readOnly
                        value={
                          typeof window === "undefined"
                            ? ""
                            : `${window.location.origin}/api/webhooks/pagarme`
                        }
                      />
                    </Field>
                    <p className="small muted">
                      Eventos de pedido e cobrança são conferidos por uma
                      consulta autenticada à API. O retorno do checkout, por si
                      só, nunca aprova um pedido.
                    </p>
                    <div className="form-grid">
                      <AdminInput
                        label="Máximo de parcelas"
                        type="number"
                        min={1}
                        max={12}
                        value={settings.maxInstallments}
                        onChange={(v) => set("maxInstallments", Number(v))}
                      />
                      <AdminInput
                        label="Parcelas sem juros"
                        type="number"
                        min={1}
                        max={12}
                        value={settings.freeInstallments}
                        onChange={(v) => set("freeInstallments", Number(v))}
                      />
                      <AdminInput
                        label="Juros simples por mês (%)"
                        type="number"
                        min={0}
                        max={10}
                        step="0.1"
                        value={settings.installmentInterest}
                        onChange={(v) => set("installmentInterest", Number(v))}
                      />
                      <AdminInput
                        label="Validade do Pix (minutos)"
                        type="number"
                        min={10}
                        max={1440}
                        value={settings.pixMinutes}
                        onChange={(v) => set("pixMinutes", Number(v))}
                      />
                      <AdminInput
                        label="Vencimento do boleto (dias)"
                        type="number"
                        min={1}
                        max={10}
                        value={settings.boletoDays}
                        onChange={(v) => set("boletoDays", Number(v))}
                      />
                    </div>
                    <p className="small muted">
                      Para parcelas acima da faixa sem juros, total = valor do
                      pedido × (1 + juros mensais × número de parcelas). Confira
                      as condições contratadas antes de publicar.
                    </p>
                    <SaveSettings busy={saving} onClick={saveSettings} />
                  </div>
                  <div className="admin-panel settings-panel">
                    <div className="admin-panel-heading">
                      <div>
                        <h2>E-mails de pedido</h2>
                        <p>Confirmação de pagamento e aviso de postagem.</p>
                      </div>
                      <span
                        className={`status-pill ${data.emailReady ? "paid" : "pending"}`}
                      >
                        {data.emailReady ? "Configurado" : "Não configurado"}
                      </span>
                    </div>
                    <AdminInput
                      label="Remetente de e-mails"
                      value={settings.emailFrom}
                      onChange={(v) => set("emailFrom", v)}
                      placeholder="Super Malhas <pedidos@seudominio.com.br>"
                    />
                    <p className="small muted">
                      O envio usa o serviço Resend. Configure RESEND_API_KEY no
                      servidor e verifique o domínio do remetente. Mensagens não
                      são anunciadas como enviadas quando o serviço está
                      ausente.
                    </p>
                    <SaveSettings busy={saving} onClick={saveSettings} />
                  </div>
                </>
              )}
              {section === "mensagens" && (
                <>
                  <div className="admin-panel">
                    <div className="admin-panel-heading">
                      <div>
                        <h2>Central de atendimento</h2>
                        <p>Mensagens enviadas pelo formulário da loja.</p>
                      </div>
                      <Button variant="outline" onClick={load}>
                        <RefreshCw size={16} />
                        Atualizar
                      </Button>
                    </div>
                    {d.contacts.length ? (
                      <div className="contact-messages">
                        {d.contacts.map((c) => (
                          <article key={c.id}>
                            <header>
                              <span>
                                <b>{c.name}</b>
                                <a href={`mailto:${c.email}`}>{c.email}</a>
                              </span>
                              <span
                                className={`status-pill ${c.status === "resolved" ? "paid" : "pending"}`}
                              >
                                {c.status === "resolved"
                                  ? "Resolvido"
                                  : "Nova mensagem"}
                              </span>
                            </header>
                            <p>{c.message}</p>
                            <footer>
                              <small>{date(c.created_at)}</small>
                              <Button
                                variant="outline"
                                onClick={async () => {
                                  await api(`admin/contacts/${c.id}`, {
                                    status:
                                      c.status === "resolved"
                                        ? "new"
                                        : "resolved",
                                  });
                                  load();
                                }}
                              >
                                {c.status === "resolved"
                                  ? "Reabrir"
                                  : "Marcar como resolvida"}
                              </Button>
                            </footer>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <Empty
                        icon={MessageSquare}
                        title="Nenhuma mensagem por enquanto"
                      >
                        <p>As solicitações dos clientes aparecerão aqui.</p>
                      </Empty>
                    )}
                  </div>
                  <div className="admin-panel">
                    <div className="admin-panel-heading">
                      <div>
                        <h2>Cadastro de novidades</h2>
                        <p>
                          {d.subscribers.length} cadastros com consentimento.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() =>
                          exportCsv("super-malhas-newsletter.csv", [
                            ["E-mail", "Cadastro", "Ativo"],
                            ...d.subscribers.map((s) => [
                              s.email,
                              s.created_at,
                              s.active ? "Sim" : "Não",
                            ]),
                          ])
                        }
                      >
                        <Download size={16} />
                        Exportar cadastros
                      </Button>
                    </div>
                    {d.subscribers.slice(0, 10).map((s) => (
                      <p className="subscriber-row" key={s.email}>
                        <Mail size={16} />
                        {s.email}
                        <small>{date(s.created_at)}</small>
                      </p>
                    ))}
                  </div>
                </>
              )}
              {section === "lancamento" && (
                <div className="admin-panel settings-panel">
                  <h2>Prepare sua loja para vender.</h2>
                  <p>
                    Complete as configurações abaixo e depois ative as vendas.
                  </p>
                  <div className="launch-list">
                    {[
                      {
                        title: "Dados fiscais",
                        done: !!settings.legalName && !!settings.cnpj,
                        href: "/admin/empresa",
                      },
                      {
                        title: "E-mail de atendimento e endereço",
                        done: !!settings.email && !!settings.address,
                        href: "/admin/empresa",
                      },
                      {
                        title: "Regras de frete",
                        done: settings.shippingRules.some((r) => r.active),
                        href: "/admin/entrega",
                      },
                      {
                        title: "Estoque conferido",
                        done: settings.inventoryConfirmed,
                        href: "/admin/produtos",
                      },
                      {
                        title: "Políticas e termos publicados",
                        done:
                          !!settings.shippingPolicy &&
                          !!settings.returnPolicy &&
                          !!settings.privacyPolicy &&
                          !!settings.terms,
                        href: "/admin/politicas",
                      },
                      {
                        title: "Pagar.me em produção",
                        done:
                          data.paymentReady &&
                          data.paymentEnvironment === "production",
                        href: "/admin/pagamentos",
                      },
                    ].map((item) => (
                      <Link href={item.href} key={item.title}>
                        <span className={item.done ? "done" : ""}>
                          {item.done ? <Check size={17} /> : <span />}
                        </span>
                        <b>{item.title}</b>
                        <small>{item.done ? "Configurado" : "Pendente"}</small>
                        <ArrowRight size={16} />
                      </Link>
                    ))}
                  </div>
                  <label className="check-control">
                    <input
                      type="checkbox"
                      checked={settings.inventoryConfirmed}
                      onChange={(e) =>
                        set("inventoryConfirmed", e.target.checked)
                      }
                    />
                    Conferi o estoque real de todos os pacotes.
                  </label>
                  <label className="check-control">
                    <input
                      type="checkbox"
                      checked={settings.demoEnabled}
                      onChange={(e) => set("demoEnabled", e.target.checked)}
                    />
                    Permitir pedidos demonstrativos durante o pré-lançamento.
                  </label>
                  <label className="check-control sales-toggle">
                    <input
                      type="checkbox"
                      checked={settings.salesEnabled}
                      onChange={(e) => set("salesEnabled", e.target.checked)}
                    />
                    <span>
                      <b>Ativar vendas reais</b>
                      <small>
                        O servidor verifica todas as pendências antes de liberar
                        o checkout.
                      </small>
                    </span>
                  </label>
                  <SaveSettings busy={saving} onClick={saveSettings} />
                </div>
              )}
            </>
          ) : null}
        </main>
      </div>
      {product && (
        <ProductEditor
          product={product}
          onClose={closeProduct}
          onSaved={async () => {
            closeProduct();
            await load();
            await refresh();
            toast("Produto salvo.");
          }}
        />
      )}
      {coupon && (
        <CouponEditor
          coupon={coupon}
          existing={d?.coupons.some((c) => c.code === coupon.code) || false}
          onClose={closeCoupon}
          onSaved={() => {
            closeCoupon();
            load();
            toast("Cupom salvo.");
          }}
        />
      )}
      {rule && (
        <RuleEditor
          rule={rule}
          onClose={closeRule}
          onSaved={(r) => {
            setSettings((s) => ({
              ...s,
              shippingRules: [
                ...s.shippingRules.filter((x) => x.id !== r.id),
                r,
              ],
            }));
            closeRule();
            toast(
              "Regra preparada. Clique em Salvar configurações para publicar.",
            );
          }}
        />
      )}
      {order && (
        <OrderEditor
          order={order}
          onClose={closeOrder}
          onSaved={() => {
            load();
          }}
        />
      )}
    </div>
  );
}
function AdminInput({
  label,
  value,
  onChange,
  hint = "",
  ...props
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  hint?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <Field label={label} hint={hint}>
      <input
        {...props}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
function SaveSettings({
  busy,
  onClick,
}: {
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <div className="settings-save">
      <Button busy={busy} onClick={onClick}>
        <Check size={17} />
        Salvar configurações
      </Button>
    </div>
  );
}
function OrdersTable({
  orders,
  onClick,
}: {
  orders: Order[];
  onClick: (o: Order) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Cliente</th>
            <th>Pagamento</th>
            <th>Entrega</th>
            <th>Total</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>
                <b>{o.number}</b>
                <small>
                  {date(o.created_at)}
                  {(o.demo || o.sandbox) && " · TESTE"}
                </small>
              </td>
              <td>
                {o.customer.name}
                <small>{o.customer.email}</small>
              </td>
              <td>
                <span className={`status-pill ${o.payment_status}`}>
                  {paymentLabels[o.payment_status] || o.payment_status}
                </span>
              </td>
              <td>{fulfillmentLabels[o.fulfillment]}</td>
              <td>
                <b>{money(o.total)}</b>
              </td>
              <td>
                <button
                  className="icon-button"
                  onClick={() => onClick(o)}
                  aria-label={`Abrir ${o.number}`}
                >
                  <ArrowUpRight size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function ProductEditor({
  product,
  onClose,
  onSaved,
}: {
  product: Product;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [p, setP] = useState(product),
    [specs, setSpecs] = useState(
      Object.entries(product.specs).map(([label, value]) => ({ label, value })),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal title="Gerenciar produto" onClose={onClose} wide>
      <form
        className="modal-content"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const { updated_at, ...payload } = p;
            await api("admin/products", {
              ...payload,
              specs: Object.fromEntries(
                specs
                  .filter((s) => s.label.trim())
                  .map((s) => [s.label.trim(), s.value]),
              ),
            });
            onSaved();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <AdminInput
            label="Nome do produto"
            required
            value={p.title}
            onChange={(v) => setP({ ...p, title: v })}
          />
          <AdminInput
            label="Slug / endereço"
            required
            value={p.slug}
            onChange={(v) => setP({ ...p, slug: v })}
            hint="Somente letras minúsculas, números e hífens."
          />
          <AdminInput
            label="Peças por pacote"
            required
            type="number"
            min={4}
            value={p.pieces}
            onChange={(v) => setP({ ...p, pieces: Number(v) })}
          />
          <AdminInput
            label="Preço do pacote (R$)"
            required
            type="number"
            min={1}
            step="0.01"
            value={p.price / 100}
            onChange={(v) => setP({ ...p, price: Math.round(Number(v) * 100) })}
          />
          <AdminInput
            label="Estoque disponível (pacotes)"
            required
            type="number"
            min={0}
            value={p.stock}
            onChange={(v) => setP({ ...p, stock: Number(v) })}
            hint="Quantidade disponível para novos pedidos, já descontadas as reservas."
          />
          <div className="product-image-edit">
            <img src={p.image} alt="Prévia do produto" />
            <Field label="Foto do produto" hint="JPG, PNG ou WebP. Até 4 MB.">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 4 * 1024 * 1024) { setError("A imagem deve ter até 4 MB."); e.target.value = ""; return; }
                  setBusy(true);
                  setError("");
                  try {
                    const response = await fetch("/api/media", {
                      method: "POST",
                      headers: { "Content-Type": file.type },
                      body: file,
                    });
                      const result = await response.json() as {error?:string;url:string};
                    if (!response.ok) throw new Error(result.error);
                    setP({ ...p, image: result.url });
                  } catch (error) {
                    setError((error as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </Field>
            <details>
              <summary>Usar uma imagem por endereço</summary>
              <AdminInput
                label="Endereço da imagem"
                required
                value={p.image}
                onChange={(v) => setP({ ...p, image: v })}
              />
            </details>
          </div>
          <Field label="Descrição" className="span-all">
            <textarea
              rows={4}
              value={p.description}
              onChange={(e) => setP({ ...p, description: e.target.value })}
            />
          </Field>
          <div className="span-all">
            <h4>Características do produto</h4>
            {specs.map((row, i) => (
              <div className="spec-edit-row" key={i}>
                <AdminInput
                  label="Característica"
                  value={row.label}
                  onChange={(v) =>
                    setSpecs(
                      specs.map((s, n) => (n === i ? { ...s, label: v } : s)),
                    )
                  }
                  placeholder="Ex.: Composição"
                />
                <AdminInput
                  label="Descrição"
                  value={row.value}
                  onChange={(v) =>
                    setSpecs(
                      specs.map((s, n) => (n === i ? { ...s, value: v } : s)),
                    )
                  }
                  placeholder="Ex.: 100% algodão"
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Remover característica"
                  onClick={() => setSpecs(specs.filter((_, n) => n !== i))}
                >
                  <X size={17} />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => setSpecs([...specs, { label: "", value: "" }])}
            >
              <Plus size={16} />
              Adicionar característica
            </Button>
          </div>
          <label className="check-control">
            <input
              type="checkbox"
              checked={!!p.active}
              onChange={(e) => setP({ ...p, active: e.target.checked ? 1 : 0 })}
            />
            Publicado no catálogo
          </label>
          <label className="check-control">
            <input
              type="checkbox"
              checked={!!p.featured}
              onChange={(e) =>
                setP({ ...p, featured: e.target.checked ? 1 : 0 })
              }
            />
            Pacote em destaque
          </label>
        </div>
        <ErrorBox message={error} />
        <div className="modal-actions">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button busy={busy}>Salvar produto</Button>
        </div>
      </form>
    </Modal>
  );
}
function CouponEditor({
  coupon,
  existing,
  onClose,
  onSaved,
}: {
  coupon: Coupon;
  existing: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [c, setC] = useState(coupon),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal title={existing ? "Editar cupom" : "Criar cupom"} onClose={onClose}>
      <form
        className="modal-content"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const { used, ...payload } = c;
            await api("admin/coupons", payload);
            onSaved();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <AdminInput
            label="Código"
            required
            readOnly={existing}
            value={c.code}
            onChange={(v) => setC({ ...c, code: v.toUpperCase() })}
          />
          <Field label="Tipo de desconto">
            <select
              value={c.kind}
              onChange={(e) =>
                setC({
                  ...c,
                  kind: e.target.value,
                  value: e.target.value === "percent" ? 5 : 1000,
                })
              }
            >
              <option value="percent">Percentual (%)</option>
              <option value="fixed">Valor fixo (R$)</option>
            </select>
          </Field>
          <AdminInput
            label={c.kind === "percent" ? "Percentual (%)" : "Desconto (R$)"}
            required
            type="number"
            min={1}
            step={c.kind === "percent" ? "1" : "0.01"}
            value={c.kind === "percent" ? c.value : c.value / 100}
            onChange={(v) =>
              setC({
                ...c,
                value:
                  c.kind === "percent"
                    ? Number(v)
                    : Math.round(Number(v) * 100),
              })
            }
          />
          <AdminInput
            label="Compra mínima (R$)"
            type="number"
            min={0}
            step="0.01"
            value={c.minimum / 100}
            onChange={(v) =>
              setC({ ...c, minimum: Math.round(Number(v) * 100) })
            }
          />
          <AdminInput
            label="Limite de usos"
            required
            type="number"
            min={1}
            value={c.usage_limit}
            onChange={(v) => setC({ ...c, usage_limit: Number(v) })}
          />
          <AdminInput
            label="Validade (opcional)"
            type="date"
            value={c.expires_at?.slice(0, 10) || ""}
            onChange={(v) =>
              setC({ ...c, expires_at: v ? `${v}T23:59:59-03:00` : null })
            }
          />
          <label className="check-control">
            <input
              type="checkbox"
              checked={!!c.active}
              onChange={(e) => setC({ ...c, active: e.target.checked ? 1 : 0 })}
            />
            Cupom ativo
          </label>
        </div>
        <ErrorBox message={error} />
        <div className="modal-actions">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button busy={busy}>Salvar cupom</Button>
        </div>
      </form>
    </Modal>
  );
}
function RuleEditor({
  rule,
  onClose,
  onSaved,
}: {
  rule: ShippingRule;
  onClose: () => void;
  onSaved: (r: ShippingRule) => void;
}) {
  const [r, setR] = useState(rule);
  return (
    <Modal title="Regra de entrega" onClose={onClose}>
      <form
        className="modal-content"
        onSubmit={(e) => {
          e.preventDefault();
          onSaved(r);
        }}
      >
        <div className="form-grid">
          <AdminInput
            label="Nome exibido ao cliente"
            required
            value={r.label}
            onChange={(v) => setR({ ...r, label: v })}
          />
          <AdminInput
            label="Valor do frete (R$)"
            type="number"
            min={0}
            step="0.01"
            required
            value={r.amount / 100}
            onChange={(v) =>
              setR({ ...r, amount: Math.round(Number(v) * 100) })
            }
          />
          <AdminInput
            label="Grátis a partir de (R$)"
            hint="Use 0 para desativar essa condição."
            type="number"
            min={0}
            step="0.01"
            value={r.freeAbove / 100}
            onChange={(v) =>
              setR({ ...r, freeAbove: Math.round(Number(v) * 100) })
            }
          />
          <AdminInput
            label="Prazo inicial (dias úteis)"
            required
            type="number"
            min={0}
            value={r.minDays}
            onChange={(v) => setR({ ...r, minDays: Number(v) })}
          />
          <AdminInput
            label="Prazo final (dias úteis)"
            required
            type="number"
            min={r.minDays}
            value={r.maxDays}
            onChange={(v) => setR({ ...r, maxDays: Number(v) })}
          />
        </div>
        <h4>Estados atendidos</h4>
        <p className="small muted">
          Nenhum estado selecionado = todos os estados.
        </p>
        <div className="states-grid">
          {states.map((s) => (
            <label key={s}>
              <input
                type="checkbox"
                checked={r.states.includes(s)}
                onChange={(e) =>
                  setR({
                    ...r,
                    states: e.target.checked
                      ? [...r.states, s]
                      : r.states.filter((x) => x !== s),
                  })
                }
              />
              {s}
            </label>
          ))}
        </div>
        <label className="check-control">
          <input
            type="checkbox"
            checked={r.active}
            onChange={(e) => setR({ ...r, active: e.target.checked })}
          />
          Regra ativa
        </label>
        <div className="modal-actions">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button>Preparar regra</Button>
        </div>
      </form>
    </Modal>
  );
}
function OrderEditor({
  order: initial,
  onClose,
  onSaved,
}: {
  order: Order;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [o, setO] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      title={`Pedido ${o.number}${o.demo ? " · DEMONSTRATIVO" : o.sandbox ? " · SANDBOX PAGAR.ME" : ""}`}
      onClose={onClose}
      wide
    >
      <div className="modal-content">
        <div className="admin-order-details">
          <section>
            <h3>{o.customer.name}</h3>
            <p>
              {o.customer.email}
              <br />
              {o.customer.phone}
              <br />
              {o.customer.document}
            </p>
          </section>
          <section>
            <h3>Endereço de entrega</h3>
            <p>
              {o.address.street}, {o.address.number}
              <br />
              {o.address.district} · {o.address.city}/{o.address.state}
              <br />
              CEP {o.address.zip}
            </p>
          </section>
        </div>
        <div className="admin-order-items">
          {o.items.map((i, n) => (
            <div key={n}>
              <img src={i.image} alt="Camisetas" />
              <span>
                <b>
                  {i.title} · {i.quantity} pacote(s)
                </b>
                <GradeSummary grade={i.grade} />
              </span>
              <strong>{money(i.price * i.quantity)}</strong>
            </div>
          ))}
        </div>
        <div className="total-line">
          <span>Total</span>
          <b>{money(o.total)}</b>
        </div>
        <div className="admin-payment-line">
          <span className={`status-pill ${o.payment_status}`}>
            {paymentLabels[o.payment_status]}
          </span>
          {!o.demo && (
            <Button
              busy={busy}
              variant="outline"
              onClick={async () => {
                setBusy(true);
                try {
                  setO(await api(`admin/orders/${o.id}/sync`, {}));
                  onSaved();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RefreshCw size={15} />
              Conferir no Pagar.me
            </Button>
          )}
          {o.demo && (
            <select
              aria-label="Simular pagamento"
              value={o.payment_status}
              onChange={async (e) => {
                setBusy(true);
                try {
                  setO(
                    await api(`admin/orders/${o.id}/demo-payment`, {
                      status: e.target.value,
                    }),
                  );
                  onSaved();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <option value="pending">Simular: aguardando</option>
              <option value="paid">Simular: aprovado</option>
              <option value="failed">Simular: recusado</option>
              <option value="refunded">Simular: estornado</option>
            </select>
          )}
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              setO(
                await api(`admin/orders/${o.id}`, {
                  fulfillment: o.fulfillment,
                  tracking_code: o.tracking_code || "",
                  carrier: o.carrier || "",
                  invoice_url: o.invoice_url || "",
                }),
              );
              onSaved();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-grid">
            <Field label="Etapa de entrega">
              <select
                value={o.fulfillment}
                onChange={(e) => setO({ ...o, fulfillment: e.target.value })}
              >
                <option value="new">Pedido recebido</option>
                <option value="processing">Em separação</option>
                <option value="shipped">Em transporte</option>
                <option value="delivered">Entregue</option>
              </select>
            </Field>
            <AdminInput
              label="Transportadora"
              value={o.carrier || ""}
              onChange={(v) => setO({ ...o, carrier: v })}
            />
            <AdminInput
              label="Código de rastreio"
              value={o.tracking_code || ""}
              onChange={(v) => setO({ ...o, tracking_code: v })}
            />
            <AdminInput
              label="Link da nota fiscal (HTTPS)"
              value={o.invoice_url || ""}
              onChange={(v) => setO({ ...o, invoice_url: v })}
            />
          </div>
          <ErrorBox message={error} />
          <div className="modal-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                window.open(`/pedido/${o.id}`, "_blank", "noopener")
              }
            >
              Ver página do pedido
            </Button>
            <Button busy={busy}>Salvar atualização</Button>
          </div>
        </form>
        {["creating", "pending", "failed"].includes(o.payment_status) && (
          <Button
            variant="outline"
            busy={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                setO(await api(`admin/orders/${o.id}/cancel`, {}));
                onSaved();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Cancelar tentativa sem pagamento
          </Button>
        )}
        <div className="admin-event-list">
          <h3>Histórico</h3>
          {o.events?.map((e) => (
            <p key={e.id}>
              {e.note}
              <small>{date(e.created_at)}</small>
            </p>
          ))}
        </div>
      </div>
    </Modal>
  );
}
