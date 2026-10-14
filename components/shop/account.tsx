"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package,
  ArrowRight,
  ArrowLeft,
  Check,
  Truck,
  House,
  CreditCard,
  Copy,
  RefreshCw,
  ExternalLink,
  UserRound,
  Heart,
  LogOut,
  FileText,
  ShieldCheck,
  Download,
} from "lucide-react";
import { useShop, api } from "./context";
import type { Order } from "@/lib/shop/types";
import {
  date,
  money,
  paymentLabels,
  fulfillmentLabels,
} from "@/lib/shop/types";
import {
  Button,
  LinkButton,
  Empty,
  ErrorBox,
  Breadcrumb,
  WhatsApp,
  GradeSummary,
  ProductCard,
} from "./ui";
import { Summary } from "./cart";
import { TransparentPaymentPanel } from "./transparent-payment";
export function AccountPage() {
  const { data } = useShop();
  const [orders, setOrders] = useState<Order[]>([]),
    [tab, setTab] = useState("orders"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [favorites, setFavorites] = useState<string[]>([]);
  useEffect(() => {
    api<Order[]>("orders")
      .then(rows => setOrders(rows.filter(order => !order.demo && !order.sandbox)))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    try {
      setFavorites(JSON.parse(localStorage.getItem("sm-wishlist") || "[]"));
    } catch {}
  }, [data.user?.userId]);
  return (
    <div className="container section account-page">
      <Breadcrumb items={[{ label: "Minha conta" }]} />
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <i />
            BOM TER VOCÊ POR AQUI
          </span>
          <h1>
            {data.user
              ? `Olá, ${data.user.displayName.split(" ")[0]}.`
              : "Seu negócio, bem acompanhado."}
          </h1>
          <p>Pedidos, favoritos e informações em um só lugar.</p>
        </div>
        {data.user && (
          <form action="/auth/logout" method="post"><button type="submit" className="text-link">
            <LogOut size={16} />
            Sair da conta
          </button></form>
        )}
      </div>
      <div className="account-layout">
        <aside className="account-menu">
          <div>
            <span className="account-avatar">
              <UserRound size={25} />
            </span>
            <strong>{data.user?.displayName || "Visitante"}</strong>
            <small>{data.user?.email || "Pedidos deste navegador"}</small>
          </div>
          <button
            className={tab === "orders" ? "active" : ""}
            onClick={() => setTab("orders")}
          >
            <Package size={18} />
            Meus pedidos
          </button>
          <button
            className={tab === "favorites" ? "active" : ""}
            onClick={() => setTab("favorites")}
          >
            <Heart size={18} />
            Meus favoritos
          </button>
          {data.admin && (
            <Link href="/admin">
              <ShieldCheck size={18} />
              Administração
            </Link>
          )}
          <WhatsApp label="Preciso de ajuda" />
        </aside>
        <div>
          {!data.user && (
            <div className="account-signin">
              <span>
                <h3>Seu histórico sempre com você.</h3>
                <p>
                  Ao entrar, os pedidos de visitante deste navegador passam para
                  sua conta e podem ser acompanhados em outros dispositivos.
                </p>
              </span>
              <a
                href="/entrar?return_to=/minha-conta"
                target="_top"
                className="btn dark"
              >
                <UserRound size={17} />
                Entrar na minha conta
              </a>
            </div>
          )}
          <ErrorBox message={error} />
          {tab === "orders" ? (
            loading ? (
              <p>Buscando seus pedidos…</p>
            ) : orders.length ? (
              <div className="account-orders">
                {orders.map((order) => (
                  <Link
                    className="account-order-card"
                    href={`/pedido/${order.id}`}
                    key={order.id}
                  >
                    <header>
                      <span>
                        <b>{order.number}</b>
                        <small>{date(order.created_at)}</small>
                      </span>
                      <span className={`status-pill ${order.payment_status}`}>
                        {paymentLabels[order.payment_status] ||
                          order.payment_status}
                      </span>
                    </header>
                    <div>
                      <img src={order.items[0].image} alt="Camisetas brancas" />
                      <span>
                        <strong>
                          {order.items.reduce(
                            (n, i) => n + i.pieces * i.quantity,
                            0,
                          )}{" "}
                          camisetas brancas
                        </strong>
                        <small>{fulfillmentLabels[order.fulfillment]}</small>
                      </span>
                      <b>{money(order.total)}</b>
                      <ArrowRight size={19} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty icon={Package} title="Seu primeiro pedido está por vir.">
                <p>Explore os pacotes e dê o próximo passo.</p>
                <LinkButton href="/camisetas">
                  Conhecer os pacotes <ArrowRight size={17} />
                </LinkButton>
              </Empty>
            )
          ) : favorites.length ? (
            <div className="product-grid favorites-grid">
              {data.products
                .filter((p) => favorites.includes(p.id))
                .map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
            </div>
          ) : (
            <Empty icon={Heart} title="Guarde suas melhores escolhas.">
              <p>Toque no coração na página de um produto para salvar aqui.</p>
              <LinkButton href="/camisetas">Explorar os pacotes</LinkButton>
            </Empty>
          )}
        </div>
      </div>
    </div>
  );
}
export function OrderPage({ id }: { id: string }) {
  const { data, toast } = useShop();
  const [order, setOrder] = useState<Order | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const load = async (sync = false) => {
    setBusy(true);
    setError("");
    try {
      setOrder(
        await api(`orders/${id}${sync ? "/sync" : ""}`, sync ? {} : undefined),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setBusy(false);
    }
  };
  useEffect(() => {
    load();
  }, [id, data.user?.userId]);
  useEffect(() => {
    if (
      !order ||
      order.demo ||
      !["pending", "creating"].includes(order.payment_status)
    )
      return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load(true);
    }, 30000);
    return () => clearInterval(timer);
  }, [order?.payment_status, order?.demo]);
  if (loading)
    return (
      <div className="container section">
        <p>Carregando os detalhes do pedido…</p>
      </div>
    );
  if (!order)
    return (
      <div className="container section">
        <ErrorBox message={error} />
        <LinkButton href="/minha-conta">Meus pedidos</LinkButton>
      </div>
    );
  if (order.demo || order.sandbox) return <div className="container section"><Empty title="Registro sem cobrança"><p>Este registro anterior não constitui uma compra válida para pagamento ou envio.</p><LinkButton href="/minha-conta">Meus pedidos</LinkButton></Empty></div>;
  const paid = order.payment_status === "paid",
    status = paymentLabels[order.payment_status] || order.payment_status;
  const stage =
    order.fulfillment === "delivered"
      ? 3
      : order.fulfillment === "shipped"
        ? 2
        : order.fulfillment === "processing" || paid
          ? 1
          : 0;
  return (
    <div className="container section order-page">
      <Breadcrumb
        items={[
          { label: "Minha conta", href: "/minha-conta" },
          { label: order.number },
        ]}
      />
      <div className="order-header">
        <span className={`order-success-icon ${paid ? "paid" : ""}`}>
          {paid ? <Check size={37} /> : <Package size={37} />}
        </span>
        <div>
          <span className="eyebrow">
            <i />
            OBRIGADO PELA SUA ESCOLHA
          </span>
          <h1>
            {paid
              ? "Pagamento aprovado!"
              : order.payment_status === "failed"
                ? "Vamos resolver seu pagamento."
                : order.payment_status === "refunded"
                  ? "Pagamento estornado."
                  : "Seu pedido foi recebido."}
          </h1>
          <p>
            {paid
                  ? "Agora vamos preparar suas camisetas. Você pode acompanhar cada etapa por aqui."
                  : "A confirmação da compra depende da aprovação do pagamento pelo Pagar.me."}
          </p>
        </div>
        <span>
          <b>{order.number}</b>
          <small>{date(order.created_at)}</small>
        </span>
      </div>
      <div className="checkout-layout">
        <div>
          <ErrorBox message={error} />
          <section className="form-panel order-payment">
            <div>
              <CreditCard size={24} />
              <span>
                <h2>{status}</h2>
                <p>
                  {`Forma de pagamento: ${order.payment_method === "credit_card" ? "Cartão de crédito" : order.payment_method === "boleto" ? "Boleto" : "Pix"}.`}
                </p>
              </span>
              <span className={`status-pill ${order.payment_status}`}>
                {status}
              </span>
            </div>
            {order.payment_config?.checkout !== "transparent" && !order.demo &&
              ["pending", "creating"].includes(order.payment_status) && (
                <div className="order-pay-actions">
                  {order.payment_link ? (
                    <a href={order.payment_link} className="btn primary">
                      Continuar pagamento <ExternalLink size={17} />
                    </a>
                  ) : (
                    <Button
                      busy={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const r = await api(`orders/${id}/payment`, {});
                          window.location.assign(r.url);
                        } catch (e) {
                          setError((e as Error).message);
                          setBusy(false);
                        }
                      }}
                    >
                      Preparar pagamento <ArrowRight size={17} />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    busy={busy}
                    onClick={() => load(true)}
                  >
                    <RefreshCw size={16} />
                    Já paguei, atualizar
                  </Button>
                </div>
              )}
          </section>
          {order.payment_config?.checkout === "transparent" && <TransparentPaymentPanel order={order} refresh={() => load(true)} />}
          {!order.demo && order.payment_status === "failed" && (
            <LinkButton href="/camisetas" variant="outline">
              Escolher um pacote para tentar novamente <ArrowRight size={16} />
            </LinkButton>
          )}
          {order.charged_total && order.charged_total !== order.total && (
            <p className="info-note">
              Valor confirmado pelo Pagar.me, incluindo juros:{" "}
              <b>{money(order.charged_total)}</b>.
            </p>
          )}
          {["pending", "creating"].includes(order.payment_status) && (
            <Button
              variant="plain"
              busy={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  setOrder(await api(`orders/${id}/cancel`, {}));
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Cancelar tentativa de compra
            </Button>
          )}
          <div className="order-timeline">
            {[
              {
                title: "Pedido recebido",
                sub: "Sua grade está registrada",
                icon: Check,
              },
              {
                title: "Em separação",
                sub: paid ? "Preparando suas camisetas" : "Após o pagamento",
                icon: Package,
              },
              {
                title: "Em transporte",
                sub: order.tracking_code || "Aguardando postagem",
                icon: Truck,
              },
              {
                title: "Entregue",
                sub: "Seu próximo passo começa",
                icon: House,
              },
            ].map(({ title, sub, icon: Icon }, i) => (
              <div key={title} className={i <= stage ? "active" : ""}>
                <span>
                  <Icon size={22} />
                </span>
                <b>{title}</b>
                <small>{sub}</small>
              </div>
            ))}
          </div>
          {order.tracking_code && (
            <section className="tracking-panel">
              <Truck size={29} />
              <div>
                <h3>Seu pedido está a caminho.</h3>
                <p>
                  {order.carrier} · Código: <b>{order.tracking_code}</b>
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  navigator.clipboard
                    .writeText(order.tracking_code!)
                    .then(() => toast("Código de rastreio copiado."))
                    .catch(() => toast("Selecione o código para copiar."))
                }
              >
                <Copy size={16} />
                Copiar rastreio
              </Button>
            </section>
          )}
          <div className="order-info-grid">
            <section className="form-panel">
              <h3>
                <UserRound size={19} />
                Dados do comprador
              </h3>
              <p>
                {order.customer.name}
                <br />
                {order.customer.email}
                <br />
                {order.customer.phone}
              </p>
            </section>
            <section className="form-panel">
              <h3>
                <Truck size={19} />
                Entrega
              </h3>
              <p>
                {order.address.street}, {order.address.number}
                <br />
                {order.address.complement && (
                  <>
                    {order.address.complement}
                    <br />
                  </>
                )}
                {order.address.district} · {order.address.city}/
                {order.address.state}
                <br />
                CEP {order.address.zip}
              </p>
              <small>{order.shipping.label}</small>
              {order.shipping.toArrange && <p>Frete pago à parte. Valor, transportadora e prazo devem ser combinados com o SAC antes do pagamento dos produtos.</p>}
            </section>
          </div>
          <section className="form-panel order-events">
            <h3>Histórico do pedido</h3>
            {order.events
              ?.filter((e) => !e.type.startsWith("email."))
              .map((e) => (
                <div key={e.id}>
                  <i />
                  <span>
                    {e.note}
                    <small>{date(e.created_at)}</small>
                  </span>
                </div>
              ))}
          </section>
          <div className="order-final-actions">
            <LinkButton href="/camisetas" variant="outline">
              <ArrowLeft size={17} />
              Continuar comprando
            </LinkButton>
            <button className="btn outline" onClick={() => window.print()}>
              <Download size={17} />
              Imprimir pedido
            </button>
            {order.invoice_url && (
              <a
                href={order.invoice_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn outline"
              >
                <FileText size={17} />
                Nota fiscal
              </a>
            )}
          </div>
        </div>
        <div>
          <Summary
            items={order.items}
            subtotal={order.subtotal}
            discount={order.discount}
            shipping={order.shipping}
          />
          <div className="help-panel">
            <h3>Estamos por aqui.</h3>
            <p>Tenha o número {order.number} em mãos ao falar com a equipe.</p>
            <WhatsApp
              message={`Olá! Preciso de ajuda com o pedido ${order.number}.`}
              label="Falar com nossa equipe"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
