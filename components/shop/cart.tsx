"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  ArrowLeft,
  ArrowRight,
  Trash2,
  LockKeyhole,
  Ticket,
  Package,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { useShop, api } from "./context";
import { money } from "@/lib/shop/types";
import type { OrderItem, ShippingQuote } from "@/lib/shop/types";
import {
  Button,
  LinkButton,
  Empty,
  Breadcrumb,
  Quantity,
  GradeSummary,
  ErrorBox,
  ProductCard,
} from "./ui";
export function CouponInput({
  onApplied,
}: {
  onApplied?: (discount: number) => void;
}) {
  const { cart, coupon, setCoupon, toast } = useShop();
  const [value, setValue] = useState(coupon),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="coupon-box">
      <label htmlFor="coupon">
        <Ticket size={20} />
        <strong>Cupom de desconto</strong>
      </label>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const result = await api("quote", { items: cart, coupon: value });
            setCoupon(result.coupon || "");
            onApplied?.(result.discount);
            toast(result.discount ? "Cupom aplicado." : "Cupom removido.");
          } catch (e) {
            setCoupon("");
            onApplied?.(0);
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          id="coupon"
          placeholder="Seu cupom"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          maxLength={40}
        />
        <Button variant="outline" busy={busy}>
          Aplicar
        </Button>
      </form>
      {coupon && (
        <div className="applied-coupon">
          {coupon} aplicado{" "}
          <button
            onClick={() => {
              setCoupon("");
              setValue("");
              onApplied?.(0);
            }}
          >
            Remover
          </button>
        </div>
      )}
      <ErrorBox message={error} />
    </div>
  );
}
export function Summary({
  items,
  subtotal,
  discount = 0,
  shipping,
  children,
}: {
  items: OrderItem[];
  subtotal: number;
  discount?: number;
  shipping?: ShippingQuote | null;
  children?: React.ReactNode;
}) {
  const packageCount = items.reduce((n, i) => n + i.quantity, 0);
  return (
    <aside className="order-summary">
      <div className="summary-heading">
        <h2>Resumo do pedido</h2>
        <span>{packageCount} {packageCount === 1 ? "pacote" : "pacotes"}</span>
      </div>
      <div className="summary-items">
        {items.map((i, index) => (
          <div key={index}>
            <img src={i.image} alt="Camisetas brancas" />
            <span>
              <strong>{i.title}</strong>
              <small>
                {i.quantity} {i.quantity === 1 ? "pacote" : "pacotes"} · {i.pieces * i.quantity} peças
              </small>
              <GradeSummary grade={i.grade} />
            </span>
            <b>{money(i.price * i.quantity)}</b>
          </div>
        ))}
      </div>
      <dl className="totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{money(subtotal)}</dd>
        </div>
        {discount > 0 && (
          <div className="discount-line">
            <dt>Desconto</dt>
            <dd>− {money(discount)}</dd>
          </div>
        )}
        <div>
          <dt>Entrega</dt>
          <dd>
            {shipping
              ? shipping.toArrange ? "A combinar, pago à parte" : shipping.amount === 0
                ? "Grátis"
                : money(shipping.amount)
              : "Calcular no checkout"}
          </dd>
        </div>
      </dl>
      <div className="total-line">
        <span>{shipping?.toArrange ? "Total dos produtos" : "Total"}</span>
        <strong>{money(subtotal - discount + (shipping?.amount || 0))}</strong>
      </div>
      {shipping?.toArrange && <p className="notice">O frete não está incluído neste pagamento. Consulte o SAC para combinar valor, transportadora e prazo antes de pagar os produtos. O envio depende desse acordo.</p>}
      {children}
      <div className="summary-safe">
        <ShieldCheck size={20} />
        <span>
          <strong>Pagamento protegido</strong>
          <small>Processado pelo Pagar.me.</small>
        </span>
      </div>
    </aside>
  );
}
export function CartPage() {
  const { cart, data, change, remove, coupon, ready } = useShop();
  const [discount, setDiscount] = useState(0),
    [quoteError, setQuoteError] = useState("");
  const items = cart
    .map((i) => {
      const p = data.products.find((p) => p.id === i.productId);
      return p
        ? {
            ...i,
            title: p.title,
            pieces: p.pieces,
            price: p.price,
            image: p.image,
          }
        : null;
    })
    .filter(Boolean) as OrderItem[];
  const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
  useEffect(() => {
    if (!cart.length) return;
    let alive = true;
    api("quote", { items: cart, coupon })
      .then((r) => {
        if (alive) {
          setDiscount(r.discount);
          setQuoteError("");
        }
      })
      .catch((e) => {
        if (alive) {
          setDiscount(0);
          setQuoteError(e.message);
        }
      });
    return () => {
      alive = false;
    };
  }, [cart, coupon]);
  if (!ready)
    return (
      <div className="container section">
        <p>Carregando seu carrinho…</p>
      </div>
    );
  if (!cart.length)
    return (
      <div className="container section">
        <Breadcrumb items={[{ label: "Carrinho" }]} />
        <Empty title="Seu próximo pedido começa aqui.">
          <p>
            O carrinho está vazio. Encontre o pacote ideal para o seu negócio.
          </p>
          <LinkButton href="/camisetas">
            Explorar os pacotes <ArrowRight size={18} />
          </LinkButton>
        </Empty>
        <div className="product-grid">
          {data.products.map((p) => (
            <ProductCard product={p} key={p.id} />
          ))}
        </div>
      </div>
    );
  return (
    <div className="container section cart-page">
      <Breadcrumb items={[{ label: "Carrinho" }]} />
      <div className="page-heading">
        <div>
          <EyebrowCart />
          <h1>
            Meu carrinho
            <span className="count-pill">
              {items.reduce((n, i) => n + i.quantity, 0)}
            </span>
          </h1>
          <p>Uma boa escolha para o seu negócio. Revise seu pedido.</p>
        </div>
        <Link href="/camisetas" className="text-link">
          <ArrowLeft size={17} />
          Continuar comprando
        </Link>
      </div>
      <div className="checkout-layout">
        <div>
          <div className="cart-table">
            <div className="cart-table-head">
              <span>Produto</span>
              <span>Quantidade</span>
              <span>Subtotal</span>
              <span />
            </div>
            {cart.map((i, index) => {
              const p = data.products.find((p) => p.id === i.productId);
              return p ? (
                <div className="cart-row" key={index}>
                  <div className="cart-product">
                    <Link href={`/produto/${p.slug}`}>
                      <img src={p.image} alt="Camisetas brancas" />
                    </Link>
                    <div>
                      <Link href={`/produto/${p.slug}`}>
                        <h3>{p.title}</h3>
                      </Link>
                      <p>Malha peruana · {p.pieces} peças por pacote</p>
                      <GradeSummary grade={i.grade} />
                      <small>{money(p.price)} por pacote</small>
                    </div>
                  </div>
                  <Quantity
                    value={i.quantity}
                    onChange={(n) => change(index, n)}
                    max={data.demo || data.sandbox ? 20 : p.stock}
                  />
                  <strong>{money(p.price * i.quantity)}</strong>
                  <button
                    className="icon-button"
                    onClick={() => remove(index)}
                    aria-label={`Remover ${p.title}`}
                  >
                    <Trash2 size={19} />
                  </button>
                </div>
              ) : (
                <div className="notice error" key={index}>
                  Produto indisponível no catálogo.
                  <Button onClick={() => remove(index)} variant="plain">
                    Remover
                  </Button>
                </div>
              );
            })}
          </div>
          <CouponInput onApplied={setDiscount} />
          <ErrorBox message={quoteError} />
          <div className="cart-note">
            <Package size={23} />
            <span>
              <b>Sua grade está registrada.</b>
              <p>
                As quantidades por tamanho aparecem no pedido para a separação
                dos pacotes.
              </p>
            </span>
          </div>
        </div>
        <Summary items={items} subtotal={subtotal} discount={discount}>
          <LinkButton href="/checkout" className="full">
            <LockKeyhole size={18} />
            Finalizar compra
            <ArrowRight size={18} />
          </LinkButton>
          <small className="summary-note">
            {items.reduce((n, i) => n + i.pieces * i.quantity, 0)} peças para o
            próximo passo do seu negócio.
          </small>
        </Summary>
      </div>
    </div>
  );
}
function EyebrowCart() {
  return (
    <span className="eyebrow">
      <i />
      QUASE TUDO PRONTO
    </span>
  );
}
