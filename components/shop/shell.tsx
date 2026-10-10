"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  UserRound,
  ShoppingBag,
  Menu,
  X,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  ShieldCheck,
  Truck,
  Mail,
  MapPin,
  Phone,
  Trash2,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useShop, api } from "./context";
import { money } from "@/lib/shop/types";
import {
  Button,
  LinkButton,
  WhatsApp,
  Benefits,
  GradeSummary,
  Quantity,
  Modal,
  ErrorBox,
} from "./ui";
export function Header() {
  const { data, cart } = useShop(),
    path = usePathname(),
    router = useRouter();
  const [search, setSearch] = useState(""),
    [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [path]);
  return (
    <>
      <a href="#conteudo" className="skip-link">
        Ir para o conteúdo
      </a>
      <div className="topbar">
        <span>QUALIDADE QUE VESTE SEU NEGÓCIO</span>
        <span>
          <Truck size={14} /> Atacado a partir de{" "}
          {data.products.length
            ? Math.min(...data.products.map((p) => p.pieces))
            : 200}{" "}
          peças <i /> Compra protegida
        </span>
      </div>
      <header className="site-header">
        <div className="header-main container">
          <Link
            href="/"
            className="brand"
            aria-label="Super Malhas Atacado — Início"
          >
            <img src="/images/logo.png" alt="Super Malhas Atacado" />
          </Link>
          <form
            className="search-form"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(`/camisetas?q=${encodeURIComponent(search.trim())}`);
            }}
          >
            <Search size={19} />
            <input
              aria-label="Buscar produtos"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="O que seu negócio precisa hoje?"
            />
            <button aria-label="Pesquisar">
              <ArrowRight size={18} />
            </button>
          </form>
          <Link
            href="/minha-conta"
            className="header-action"
            aria-label="Minha conta"
          >
            <UserRound size={23} />
            <span>
              Bem-vindo(a)
              <strong>{data.user ? "Minha conta" : "Entrar na conta"}</strong>
            </span>
          </Link>
          <Link
            href="/carrinho"
            className="header-action cart-link"
            aria-label={`Meu carrinho, ${cart.reduce((s, i) => s + i.quantity, 0)} pacotes`}
          >
            <span className="cart-icon">
              <ShoppingBag size={25} />
              <b>{cart.reduce((s, i) => s + i.quantity, 0)}</b>
            </span>
            <span>
              Seu próximo passo<strong>Meu carrinho</strong>
            </span>
          </Link>
          <button
            className="icon-button mobile-menu-button"
            onClick={() => setMenu(!menu)}
            aria-label={menu ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menu}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
        <div className={`nav-row ${menu ? "open" : ""}`}>
          <div className="container nav-inner">
            <nav aria-label="Navegação principal">
              {[
                { label: "Início", href: "/" },
                { label: "Camisetas", href: "/camisetas" },
                { label: "Atacado", href: "/atacado" },
                { label: "Sobre nós", href: "/sobre" },
                { label: "Contato", href: "/contato" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={
                    (
                      link.href === "/"
                        ? path === "/"
                        : path.startsWith(link.href) ||
                          (link.href === "/camisetas" &&
                            path.startsWith("/produto/"))
                    )
                      ? "active"
                      : ""
                  }
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <WhatsApp label="Atendimento para seu negócio" variant="plain" />
          </div>
        </div>
      </header>
    </>
  );
}
export function Footer() {
  const { data, toast } = useShop(),
    s = data.settings;
  const [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <section className="newsletter-band">
        <div className="container newsletter-layout">
          <div>
            <span className="eyebrow light">
              <i />
              FIQUE POR DENTRO
            </span>
            <h2>Seu negócio sempre um passo à frente.</h2>
            <p>Cadastre-se para receber novidades e condições de atacado.</p>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await api("newsletter", { email, consent: true });
                setEmail("");
                toast(
                  "Cadastro realizado. Você poderá receber novidades da loja.",
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="newsletter-input">
              <Mail size={19} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Seu melhor e-mail"
                aria-label="E-mail para novidades"
              />
              <Button busy={busy} aria-label="Cadastrar e-mail">
                <ArrowRight size={20} />
              </Button>
            </div>
            <small>
              Ao cadastrar, você concorda em receber novidades.{" "}
              <Link href="/politicas/privacidade">Política de privacidade</Link>
              .
            </small>
            <ErrorBox message={error} />
          </form>
        </div>
      </section>
      <footer className="site-footer">
        <div className="container footer-grid">
          <div className="footer-intro">
            <Link href="/" className="footer-wordmark">
              Super<span>malhas.</span>
              <small>ATACADO</small>
            </Link>
            <p>
              Malha de qualidade.
              <br />
              Possibilidades para o seu negócio.
            </p>
            <div className="footer-social">
              <ShieldCheck size={18} />
              <span>Pagamento processado pelo Pagar.me</span>
            </div>
          </div>
          <div>
            <h3>Explore a loja</h3>
            <Link href="/camisetas">Todos os pacotes</Link>
            <Link href="/atacado">Comprar no atacado</Link>
            <Link href="/sobre">Conheça a Super Malhas</Link>
            <Link href="/minha-conta">Meus pedidos</Link>
          </div>
          <div>
            <h3>Informações úteis</h3>
            <Link href="/politicas/entrega">Envio e entrega</Link>
            <Link href="/politicas/trocas">Trocas e devoluções</Link>
            <Link href="/politicas/privacidade">Privacidade</Link>
            <Link href="/politicas/termos">Termos de compra</Link>
            <Link href="/contato">Central de atendimento</Link>
          </div>
          <div>
            <h3>Conte com a gente</h3>
            {s.email && (
              <a href={`mailto:${s.email}`}>
                <Mail size={15} />
                {s.email}
              </a>
            )}
            {s.phone && (
              <a href={`tel:+55${s.phone.replace(/\D/g, "")}`}>
                <Phone size={15} />
                {s.phone}
              </a>
            )}
            <p>
              <MapPin size={15} />
              {s.address || "Endereço em configuração"}
            </p>
            {s.businessHours && <small>{s.businessHours}</small>}
            {data.admin && (
              <Link href="/admin" className="admin-footer">
                Painel administrativo <ArrowUpRight size={13} />
              </Link>
            )}
          </div>
        </div>
        <div className="container footer-bottom">
          <p>
            © {new Date().getFullYear()} Super Malhas Atacado. {s.legalName}
            <br />
            {s.cnpj && `CNPJ ${s.cnpj}`}
          </p>
          <div className="payment-marks">
            <b>VISA</b>
            <span className="mastercard">
              <i />
              <i />
            </span>
            <b>elo</b>
            <b>Pix</b>
            <span>BOLETO</span>
          </div>
        </div>
      </footer>
    </>
  );
}
export function CartDrawer() {
  const { drawer, setDrawer, cart, data, change, remove } = useShop();
  const close = useCallback(() => setDrawer(false), [setDrawer]);
  if (!drawer) return null;
  const rows = cart.map((i, index) => ({
    i,
    index,
    p: data.products.find((p) => p.id === i.productId),
  }));
  const total = rows.reduce((n, r) => n + (r.p?.price || 0) * r.i.quantity, 0);
  return (
    <Modal title="Adicionado ao seu carrinho" onClose={close}>
      <div className="drawer-content">
        {rows.map(({ i, index, p }) =>
          p ? (
            <div className="mini-cart-row" key={index}>
              <img src={p.image} alt="Camisetas brancas" />
              <div>
                <Link href={`/produto/${p.slug}`} onClick={close}>
                  <strong>{p.title}</strong>
                </Link>
                <small>{p.pieces} peças por pacote</small>
                <GradeSummary grade={i.grade} />
                <Quantity
                  value={i.quantity}
                  onChange={(n) => change(index, n)}
                />
              </div>
              <div>
                <b>{money(p.price * i.quantity)}</b>
                <button
                  className="icon-button"
                  onClick={() => remove(index)}
                  aria-label={`Remover ${p.title}`}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          ) : null,
        )}
        <div className="total-line">
          <span>Subtotal</span>
          <strong>{money(total)}</strong>
        </div>
        <p className="muted small">
          O frete é calculado para o seu endereço no checkout.
        </p>
        <Link href="/carrinho" onClick={close} className="btn primary full">
          Ver carrinho e finalizar <ArrowRight size={18} />
        </Link>
        <Button variant="plain" className="full" onClick={close}>
          Continuar comprando
        </Button>
      </div>
    </Modal>
  );
}
export function PreviewBanner() {
  const { data } = useShop();
  return !data.settings.salesEnabled ? (
    <div className="preview-banner">
      <span>
        <i />
        {data.sandbox
          ? "Sandbox Pagar.me · Ambiente de teste, sem vendas reais"
          : data.demo
            ? "Pré-lançamento · Experimente a compra sem cobranças"
            : "Pré-lançamento · Vendas serão liberadas em breve"}
      </span>
      {data.admin && (
        <Link href="/admin">
          Configurar a loja <ChevronRight size={13} />
        </Link>
      )}
    </div>
  ) : null;
}
