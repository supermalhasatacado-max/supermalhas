"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  UserRound,
  Truck,
  CreditCard,
  LockKeyhole,
  ShieldCheck,
  Landmark,
  QrCode,
  Package,
  ExternalLink,
} from "lucide-react";
import type {
  Customer,
  Address,
  OrderItem,
  ShippingQuote,
  Order,
} from "@/lib/shop/types";
import { money } from "@/lib/shop/types";
import {
  customerSchema,
  addressSchema,
  states,
  digits,
} from "@/lib/shop/validation";
import { useShop, api } from "./context";
import {
  Button,
  LinkButton,
  Field,
  ErrorBox,
  Empty,
  Breadcrumb,
  WhatsApp,
} from "./ui";
import { Summary, CouponInput } from "./cart";
const initialCustomer: Customer = {
  type: "individual",
  name: "",
  document: "",
  email: "",
  phone: "",
  marketing: false,
};
const initialAddress: Address = {
  zip: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
};
export function CheckoutPage() {
  const { data, cart, coupon, clear, ready, toast } = useShop(),
    router = useRouter();
  const [step, setStep] = useState(0),
    [customer, setCustomer] = useState<Customer>(initialCustomer),
    [address, setAddress] = useState<Address>(initialAddress),
    [shipping, setShipping] = useState<ShippingQuote[]>([]),
    [shippingId, setShippingId] = useState(""),
    [discount, setDiscount] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [cepBusy, setCepBusy] = useState(false),
    [method, setMethod] = useState("pix"),
    [accepted, setAccepted] = useState(false),
    [saveProfile, setSaveProfile] = useState(false);
  const requestKey = useRef("");
  useEffect(() => {
    requestKey.current = crypto.randomUUID();
  }, []);
  useEffect(() => {
    if (data.user) {
      setCustomer((v) => ({
        ...v,
        name: v.name || data.user!.displayName,
        email: v.email || data.user!.email,
      }));
      api("profile")
        .then((profile) => {
          if (profile) {
            setCustomer(profile.customer);
            setAddress(profile.address);
          }
        })
        .catch(() => {});
    }
  }, [data.user?.userId]);
  useEffect(() => {
    if (!cart.length) return;
    let alive = true;
    api("quote", { items: cart, coupon, state: address.state })
      .then((r) => {
        if (alive) {
          setDiscount(r.discount);
          setShipping(r.shipping);
          setShippingId((id) =>
            r.shipping.some((s: ShippingQuote) => s.id === id)
              ? id
              : r.shipping[0]?.id || "",
          );
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [cart, coupon, address.state]);
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
  const subtotal = items.reduce((n, i) => n + i.quantity * i.price, 0),
    selectedShipping = shipping.find((r) => r.id === shippingId);
  const go = (n: number) => {
    setError("");
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const lookup = async () => {
    if (digits(address.zip).length !== 8) return;
    setCepBusy(true);
    setError("");
    try {
      const r = await api(`cep/${digits(address.zip)}`);
      setAddress((v) => ({ ...v, ...r }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCepBusy(false);
    }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (step === 0) {
      const parsed = customerSchema.safeParse(customer);
      if (!parsed.success) {
        setError(parsed.error.issues[0].message);
        return;
      }
      go(1);
      return;
    }
    if (step === 1) {
      const parsed = addressSchema.safeParse(address);
      if (!parsed.success) {
        setError(
          "Revise todos os campos do endereço. " +
            parsed.error.issues[0].message,
        );
        return;
      }
      if (!selectedShipping) {
        setError(
          "Não há entrega disponível para esse endereço. Consulte nossa equipe.",
        );
        return;
      }
      go(2);
      return;
    }
    if (!accepted) {
      setError("Leia e aceite os termos para continuar.");
      return;
    }
    setBusy(true);
    try {
      if (saveProfile && data.user) await api("profile", { customer, address });
      const order = await api<Order>("checkout", {
        items: cart,
        customer,
        address,
        shippingId,
        coupon,
        paymentMethod: method,
        requestKey: requestKey.current,
        termsAccepted: true,
        demo: data.demo,
      });
      clear();
      if (order.payment_link) window.location.assign(order.payment_link);
      else router.push(`/pedido/${order.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!ready)
    return (
      <div className="container section">
        <p>Preparando seu checkout…</p>
      </div>
    );
  if (!cart.length)
    return (
      <div className="container section">
        <Empty title="Escolha um pacote para continuar">
          <p>Adicione um pacote de camisetas ao carrinho antes de finalizar.</p>
          <LinkButton href="/camisetas">
            Ver os pacotes <ArrowRight size={18} />
          </LinkButton>
        </Empty>
      </div>
    );
  return (
    <div className="container section checkout-page">
      <Breadcrumb
        items={[
          { label: "Carrinho", href: "/carrinho" },
          { label: "Finalizar compra" },
        ]}
      />
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <i />
            PRÁTICO. SIMPLES. SEGURO.
          </span>
          <h1>Vamos fechar seu pedido.</h1>
          <p>
            {step === 0
              ? "Primeiro, conte um pouco sobre você."
              : step === 1
                ? "Onde suas camisetas vão chegar?"
                : "Escolha a melhor forma de pagar."}
          </p>
        </div>
        <span className="checkout-protection">
          <LockKeyhole size={18} />
          Pagamento protegido
        </span>
      </div>
      <div className="checkout-layout">
        <div>
          <div className="checkout-steps">
            {["Seus dados", "Entrega", "Pagamento", "Confirmação"].map(
              (label, i) => (
                <div
                  className={
                    i === step ? "current" : i < step ? "complete" : ""
                  }
                  key={label}
                >
                  <button
                    type="button"
                    onClick={() => i < step && go(i)}
                    disabled={i >= step}
                    aria-label={label}
                    aria-current={i === step ? "step" : undefined}
                  >
                    {i < step ? <Check size={17} /> : i + 1}
                  </button>
                  <span>{label}</span>
                </div>
              ),
            )}
          </div>
          <form onSubmit={submit} className="checkout-form">
            {step === 0 ? (
              <section className="form-panel">
                <h2>
                  <UserRound size={22} />
                  Seus dados
                </h2>
                <div className="person-types">
                  <label>
                    <input
                      type="radio"
                      name="person"
                      checked={customer.type === "individual"}
                      onChange={() =>
                        setCustomer({
                          ...customer,
                          type: "individual",
                          document: "",
                        })
                      }
                    />
                    Pessoa física
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="person"
                      checked={customer.type === "company"}
                      onChange={() =>
                        setCustomer({
                          ...customer,
                          type: "company",
                          document: "",
                        })
                      }
                    />
                    Pessoa jurídica
                  </label>
                </div>
                <div className="form-grid">
                  <Field
                    label={
                      customer.type === "company"
                        ? "Razão social"
                        : "Nome completo"
                    }
                    required
                  >
                    <input
                      required
                      minLength={3}
                      maxLength={64}
                      autoComplete="name"
                      value={customer.name}
                      onChange={(e) =>
                        setCustomer({ ...customer, name: e.target.value })
                      }
                      placeholder={
                        customer.type === "company"
                          ? "Nome da empresa"
                          : "Como podemos chamar você?"
                      }
                    />
                  </Field>
                  <Field
                    label={customer.type === "company" ? "CNPJ" : "CPF"}
                    required
                    hint="Necessário para identificar seu pedido."
                  >
                    <input
                      required
                      inputMode="numeric"
                      value={customer.document}
                      onChange={(e) =>
                        setCustomer({ ...customer, document: e.target.value })
                      }
                      maxLength={18}
                      placeholder={
                        customer.type === "company"
                          ? "00.000.000/0000-00"
                          : "000.000.000-00"
                      }
                    />
                  </Field>
                  <Field label="E-mail" required>
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      maxLength={64}
                      value={customer.email}
                      onChange={(e) =>
                        setCustomer({ ...customer, email: e.target.value })
                      }
                      placeholder="voce@empresa.com.br"
                    />
                  </Field>
                  <Field label="Telefone com DDD" required>
                    <input
                      required
                      type="tel"
                      autoComplete="tel-national"
                      maxLength={20}
                      value={customer.phone}
                      onChange={(e) =>
                        setCustomer({ ...customer, phone: e.target.value })
                      }
                      placeholder="(00) 00000-0000"
                    />
                  </Field>
                </div>
                <label className="check-control marketing-check">
                  <input
                    type="checkbox"
                    checked={customer.marketing}
                    onChange={(e) =>
                      setCustomer({ ...customer, marketing: e.target.checked })
                    }
                  />
                  Quero receber novidades e condições especiais.{" "}
                  <span className="muted">Opcional.</span>
                </label>
                {data.user ? (
                  <label className="check-control">
                    <input
                      type="checkbox"
                      checked={saveProfile}
                      onChange={(e) => setSaveProfile(e.target.checked)}
                    />
                    Salvar meus dados e endereço para futuras compras.
                  </label>
                ) : (
                  <p className="small muted">
                    Você pode comprar sem uma conta. Seu pedido ficará
                    disponível neste navegador.
                  </p>
                )}
              </section>
            ) : step === 1 ? (
              <>
                <section className="form-panel">
                  <h2>
                    <Truck size={22} />
                    Endereço de entrega
                  </h2>
                  <div className="address-grid">
                    <Field
                      label="CEP"
                      required
                      hint={
                        cepBusy
                          ? "Buscando endereço…"
                          : "Informe o CEP para preencher automaticamente."
                      }
                    >
                      <input
                        required
                        autoComplete="postal-code"
                        inputMode="numeric"
                        maxLength={9}
                        value={address.zip}
                        onChange={(e) =>
                          setAddress({ ...address, zip: e.target.value })
                        }
                        onBlur={lookup}
                        placeholder="00000-000"
                      />
                    </Field>
                    <Field label="Rua / Avenida" required className="span-2">
                      <input
                        required
                        autoComplete="address-line1"
                        value={address.street}
                        onChange={(e) =>
                          setAddress({ ...address, street: e.target.value })
                        }
                        placeholder="Nome da rua"
                      />
                    </Field>
                    <Field label="Número" required>
                      <input
                        required
                        value={address.number}
                        onChange={(e) =>
                          setAddress({ ...address, number: e.target.value })
                        }
                        placeholder="Nº ou S/N"
                        maxLength={15}
                      />
                    </Field>
                    <Field label="Complemento" className="span-2">
                      <input
                        autoComplete="address-line2"
                        value={address.complement}
                        onChange={(e) =>
                          setAddress({ ...address, complement: e.target.value })
                        }
                        placeholder="Apartamento, sala, referência (opcional)"
                        maxLength={100}
                      />
                    </Field>
                    <Field label="Bairro" required className="span-2">
                      <input
                        required
                        value={address.district}
                        onChange={(e) =>
                          setAddress({ ...address, district: e.target.value })
                        }
                        maxLength={60}
                      />
                    </Field>
                    <Field label="Cidade" required className="span-2">
                      <input
                        required
                        autoComplete="address-level2"
                        value={address.city}
                        onChange={(e) =>
                          setAddress({ ...address, city: e.target.value })
                        }
                        maxLength={60}
                      />
                    </Field>
                    <Field label="Estado" required className="span-2">
                      <select
                        required
                        autoComplete="address-level1"
                        value={address.state}
                        onChange={(e) =>
                          setAddress({ ...address, state: e.target.value })
                        }
                      >
                        <option value="">Selecione</option>
                        {states.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </section>
                <section className="form-panel">
                  <h2>
                    <Package size={22} />
                    Como você quer receber?
                  </h2>
                  {!address.state ? (
                    <p className="muted">
                      Preencha o endereço para ver as opções de entrega.
                    </p>
                  ) : shipping.length ? (
                    shipping.map((r) => (
                      <label
                        className={`shipping-choice ${r.id === shippingId ? "selected" : ""}`}
                        key={r.id}
                      >
                        <input
                          type="radio"
                          name="shipping"
                          value={r.id}
                          checked={shippingId === r.id}
                          onChange={() => setShippingId(r.id)}
                        />
                        <span>
                          <b>{r.label}</b>
                          <small>
                            {r.demo
                              ? "Opção de exemplo para teste. Não constitui prazo de envio."
                              : `${r.minDays} a ${r.maxDays} dias úteis após a postagem`}
                          </small>
                        </span>
                        <strong>
                          {r.amount === 0 ? "Grátis" : money(r.amount)}
                        </strong>
                      </label>
                    ))
                  ) : (
                    <div className="notice">
                      <p>
                        A entrega para este estado ainda não está disponível.
                        Fale com nossa equipe.
                      </p>
                      <WhatsApp label="Consultar entrega" />
                    </div>
                  )}
                </section>
              </>
            ) : (
              <>
                <section className="form-panel payment-panel">
                  <h2>
                    <CreditCard size={22} />
                    Forma de pagamento
                  </h2>
                  <div className="payment-choices">
                    {[
                      {
                        id: "pix",
                        title: "Pix",
                        sub: "Pagamento prático",
                        icon: QrCode,
                      },
                      {
                        id: "credit_card",
                        title: "Cartão",
                        sub: `Até ${data.settings.maxInstallments}x`,
                        icon: CreditCard,
                      },
                      {
                        id: "boleto",
                        title: "Boleto",
                        sub: "Pagamento à vista",
                        icon: Landmark,
                      },
                    ].map(({ id, title, sub, icon: Icon }) => (
                      <button
                        type="button"
                        key={id}
                        onClick={() => setMethod(id)}
                        className={method === id ? "selected" : ""}
                        aria-pressed={method === id}
                      >
                        <Icon size={28} strokeWidth={1.5} />
                        <span>
                          <b>{title}</b>
                          <small>{sub}</small>
                        </span>
                        {method === id && <Check size={16} />}
                      </button>
                    ))}
                  </div>
                  <div className="payment-explanation">
                    <div className="payment-logo">
                      pagar<span>.me</span>
                    </div>
                    <h3>
                      {method === "pix"
                        ? "Pague com Pix, com toda a praticidade."
                        : method === "credit_card"
                          ? "O parcelamento que combina com você."
                          : "Receba seu boleto em um ambiente protegido."}
                    </h3>
                    <p>
                      {method === "pix"
                        ? `O código Pix será gerado na etapa protegida do Pagar.me e terá validade de ${data.settings.pixMinutes} minutos. O pedido será aprovado após a confirmação do pagamento.`
                        : method === "credit_card"
                          ? `Os dados do cartão serão informados diretamente no Pagar.me. Até ${data.settings.freeInstallments}x sem juros. As demais opções e o valor final serão exibidos antes de pagar.`
                          : `O boleto será gerado pelo Pagar.me com vencimento em ${data.settings.boletoDays} dias. O pedido será aprovado após a compensação.`}
                    </p>
                    <span>
                      <ShieldCheck size={17} />
                      Dados financeiros processados diretamente pelo Pagar.me.
                    </span>
                  </div>
                  {data.sandbox && (
                    <div className="notice">
                      <b>Ambiente de teste Pagar.me.</b>
                      <p>
                        Use apenas os dados de teste do provedor. Nenhuma venda
                        real ou baixa de estoque será realizada.
                      </p>
                    </div>
                  )}
                  {data.demo && (
                    <div className="notice">
                      <b>Você está testando a loja.</b>
                      <p>
                        Este pedido é demonstrativo. Nenhuma cobrança será
                        criada e o estoque real não será alterado.
                      </p>
                    </div>
                  )}
                </section>
                <section className="form-panel review-panel">
                  <h2>Tudo certo para seguir?</h2>
                  <div>
                    <span>
                      <b>{customer.name}</b>
                      <small>{customer.email}</small>
                    </span>
                    <button
                      type="button"
                      onClick={() => go(0)}
                      className="text-link"
                    >
                      Editar
                    </button>
                  </div>
                  <div>
                    <span>
                      <b>
                        {address.street}, {address.number}
                      </b>
                      <small>
                        {address.district} · {address.city}/{address.state} ·{" "}
                        {address.zip}
                      </small>
                    </span>
                    <button
                      type="button"
                      onClick={() => go(1)}
                      className="text-link"
                    >
                      Editar
                    </button>
                  </div>
                  <label className="check-control">
                    <input
                      type="checkbox"
                      required
                      checked={accepted}
                      onChange={(e) => setAccepted(e.target.checked)}
                    />
                    <span>
                      Li e aceito os{" "}
                      <Link href="/politicas/termos" target="_blank">
                        termos de compra
                      </Link>{" "}
                      e a{" "}
                      <Link href="/politicas/privacidade" target="_blank">
                        política de privacidade
                      </Link>
                      .
                    </span>
                  </label>
                </section>
              </>
            )}
            <ErrorBox message={error} />
            <div className="checkout-buttons">
              {step === 0 ? (
                <Link href="/carrinho" className="text-link">
                  <ArrowLeft size={16} />
                  Voltar ao carrinho
                </Link>
              ) : (
                <button
                  type="button"
                  className="text-link"
                  onClick={() => go(step - 1)}
                >
                  <ArrowLeft size={16} />
                  Voltar
                </button>
              )}
              <Button type="submit" busy={busy}>
                {step === 0
                  ? "Continuar para entrega"
                  : step === 1
                    ? "Escolher pagamento"
                    : data.demo
                      ? "Criar pedido de teste"
                      : "Ir para o pagamento seguro"}
                {step === 2 ? (
                  <LockKeyhole size={17} />
                ) : (
                  <ArrowRight size={18} />
                )}
              </Button>
            </div>
          </form>
        </div>
        <div className="checkout-sidebar">
          <Summary
            items={items}
            subtotal={subtotal}
            discount={discount}
            shipping={selectedShipping}
          />
          <CouponInput onApplied={setDiscount} />
          <div className="help-panel">
            <h3>Conte com a nossa equipe.</h3>
            <p>Precisa de ajuda com o pedido?</p>
            <WhatsApp label="Fale com a gente" variant="outline" />
          </div>
        </div>
      </div>
    </div>
  );
}
