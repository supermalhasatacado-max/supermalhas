"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Mail,
  Phone,
  MapPin,
  MessageCircle,
  ArrowRight,
  Diamond,
  Layers,
  Store,
  Check,
} from "lucide-react";
import { useShop, api } from "./context";
import {
  Button,
  LinkButton,
  Breadcrumb,
  Eyebrow,
  WhatsApp,
  Field,
  ErrorBox,
} from "./ui";
import { money } from "@/lib/shop/types";
export function AboutPage() {
  const { data } = useShop();
  return (
    <>
      <section className="info-hero">
        <div className="container">
          <Eyebrow>CONHEÇA A SUPER MALHAS</Eyebrow>
          <h1>
            Uma boa malha.
            <br />
            <span>Um mundo de possibilidades.</span>
          </h1>
          <p>Estamos aqui para vestir o próximo capítulo do seu negócio.</p>
        </div>
      </section>
      <div className="container section">
        <Breadcrumb items={[{ label: "Sobre nós" }]} />
        <div className="about-layout">
          <img
            src="/images/hero.png"
            alt="Camisetas brancas em grande escala"
          />
          <div>
            <Eyebrow>NOSSA ESSÊNCIA</Eyebrow>
            <h2>
              Qualidade que começa
              <br />
              no básico.
            </h2>
            <p className="preserve-lines">{data.settings.about}</p>
            <LinkButton href="/camisetas">
              Conheça nossos pacotes <ArrowRight size={17} />
            </LinkButton>
          </div>
        </div>
        <div className="about-values">
          {[
            {
              icon: Diamond,
              title: "O cuidado em cada peça",
              text: "Camisetas em malha peruana para o seu negócio.",
            },
            {
              icon: Layers,
              title: "O volume que você precisa",
              text: "Pacotes com 200, 300 e 400 peças e grade personalizável.",
            },
            {
              icon: Store,
              title: "A parceria para crescer",
              text: "Uma base versátil para revenda, uniformes e criação.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title}>
              <Icon size={30} />
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
        <div className="company-card">
          <h3>Dados da empresa</h3>
          <p>
            {data.settings.legalName}
            <br />
            CNPJ {data.settings.cnpj}
            <br />
            {data.settings.address}
          </p>
        </div>
      </div>
    </>
  );
}
export function WholesalePage() {
  const { data } = useShop();
  return (
    <>
      <section className="info-hero wholesale-hero">
        <div className="container">
          <Eyebrow>ATACADO FEITO PARA VOCÊ</Eyebrow>
          <h1>
            Escolha o volume.
            <br />
            <span>Multiplique as possibilidades.</span>
          </h1>
          <p>
            Do primeiro estoque ao próximo grande projeto. Encontre o pacote que
            acompanha seus planos.
          </p>
          <LinkButton href="#comparar">
            Compare os pacotes <ArrowRight size={18} />
          </LinkButton>
        </div>
        <img src="/images/camisetas.png" alt="Pacote de camisetas brancas" />
      </section>
      <div className="container section" id="comparar">
        <div className="section-heading centered">
          <Eyebrow>UMA COMPRA, MUITAS IDEIAS</Eyebrow>
          <h2>O mesmo cuidado em todos os volumes.</h2>
          <p>Compare o valor total e o preço por peça de cada pacote.</p>
        </div>
        <div className="comparison-table table-wrap">
          <table>
            <thead>
              <tr>
                <th>Escolha seu pacote</th>
                {data.products.map((p) => (
                  <th key={p.id}>
                    {p.pieces} peças{p.featured && <small>EM DESTAQUE</small>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Valor do pacote</td>
                {data.products.map((p) => (
                  <td key={p.id}>
                    <b>{money(p.price)}</b>
                  </td>
                ))}
              </tr>
              <tr>
                <td>Valor por camiseta</td>
                {data.products.map((p) => (
                  <td key={p.id}>{money(p.price / p.pieces)}</td>
                ))}
              </tr>
              <tr>
                <td>Grade P, M, G e GG</td>
                {data.products.map((p) => (
                  <td key={p.id}>
                    <Check size={18} />
                    Personalizável
                  </td>
                ))}
              </tr>
              <tr>
                <td>Camisetas brancas lisas</td>
                {data.products.map((p) => (
                  <td key={p.id}>
                    <Check size={18} />
                    Malha peruana
                  </td>
                ))}
              </tr>
              <tr>
                <td>Próximo passo</td>
                {data.products.map((p) => (
                  <td key={p.id}>
                    <LinkButton
                      href={`/produto/${p.slug}`}
                      variant={p.featured ? "primary" : "outline"}
                    >
                      Escolher pacote
                      <ArrowRight size={15} />
                    </LinkButton>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="wholesale-how">
          <div>
            <span>01</span>
            <h3>Escolha seu pacote</h3>
            <p>Defina o volume que combina com a sua operação.</p>
          </div>
          <div>
            <span>02</span>
            <h3>Monte sua grade</h3>
            <p>Distribua as peças entre P, M, G e GG.</p>
          </div>
          <div>
            <span>03</span>
            <h3>Receba e crie</h3>
            <p>Revenda, uniformize ou personalize do seu jeito.</p>
          </div>
        </div>
        <div className="business-cta">
          <div>
            <Eyebrow>VAMOS ENCONTRAR A MELHOR ESCOLHA</Eyebrow>
            <h2>Planejando um pedido maior?</h2>
            <p>Fale com nossa equipe sobre sua necessidade.</p>
          </div>
          <WhatsApp variant="primary" label="Conversar sobre meu projeto" />
        </div>
      </div>
    </>
  );
}
export function ContactPage() {
  const { data } = useShop();
  const [form, setForm] = useState({
      name: "",
      email: "",
      message: "",
      website: "",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false);
  const s = data.settings;
  return (
    <div className="container section contact-page">
      <Breadcrumb items={[{ label: "Contato" }]} />
      <div className="page-heading">
        <div>
          <Eyebrow>CONTE COM A GENTE</Eyebrow>
          <h1>Vamos conversar?</h1>
          <p>Uma dúvida, um projeto ou um novo pedido. Estamos por aqui.</p>
        </div>
      </div>
      <div className="contact-layout">
        <div>
          <div className="contact-channels">
            {s.whatsapp && (
              <div>
                <MessageCircle size={27} />
                <span>
                  <h3>WhatsApp</h3>
                  <p>Uma conversa direta sobre o seu negócio.</p>
                  <WhatsApp label="Iniciar conversa" variant="plain" />
                </span>
              </div>
            )}
            {s.email && (
              <div>
                <Mail size={27} />
                <span>
                  <h3>E-mail de atendimento</h3>
                  <a href={`mailto:${s.email}`}>{s.email}</a>
                </span>
              </div>
            )}
            {s.phone && (
              <div>
                <Phone size={27} />
                <span>
                  <h3>Telefone</h3>
                  <a href={`tel:+55${s.phone.replace(/\D/g, "")}`}>{s.phone}</a>
                </span>
              </div>
            )}
            <div>
              <MapPin size={27} />
              <span>
                <h3>Nossa empresa</h3>
                <p>{s.address}</p>
                {s.businessHours && <small>{s.businessHours}</small>}
              </span>
            </div>
          </div>
          <div className="contact-links">
            <Link href="/politicas/entrega">
              Dúvidas sobre entrega <ArrowRight size={16} />
            </Link>
            <Link href="/politicas/trocas">
              Trocas e devoluções <ArrowRight size={16} />
            </Link>
            <Link href="/minha-conta">
              Acompanhar um pedido <ArrowRight size={16} />
            </Link>
          </div>
        </div>
        <section className="form-panel contact-form">
          {sent ? (
            <div className="contact-success">
              <span>
                <Check size={32} />
              </span>
              <h2>Mensagem registrada.</h2>
              <p>
                Sua solicitação foi recebida na central de atendimento da loja.
                Nossa equipe poderá responder pelo e-mail informado.
              </p>
              <Button variant="outline" onClick={() => setSent(false)}>
                Enviar outra mensagem
              </Button>
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await api("contact", form);
                  setSent(true);
                  setForm({ name: "", email: "", message: "", website: "" });
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h2>Deixe sua mensagem.</h2>
              <p>Conte o que você precisa. A gente cuida do próximo passo.</p>
              <Field label="Seu nome" required>
                <input
                  required
                  minLength={3}
                  autoComplete="name"
                  maxLength={100}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Como podemos chamar você?"
                />
              </Field>
              <Field label="Seu e-mail" required>
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="voce@empresa.com.br"
                />
              </Field>
              <Field label="Mensagem" required>
                <textarea
                  required
                  minLength={10}
                  maxLength={4000}
                  rows={5}
                  value={form.message}
                  onChange={(e) =>
                    setForm({ ...form, message: e.target.value })
                  }
                  placeholder="Fale sobre sua dúvida ou projeto…"
                />
              </Field>
              <label className="honeypot" aria-hidden="true">
                Website
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={(e) =>
                    setForm({ ...form, website: e.target.value })
                  }
                />
              </label>
              <ErrorBox message={error} />
              <Button busy={busy} className="full">
                Enviar mensagem <ArrowRight size={17} />
              </Button>
              <small className="muted">
                Seus dados serão utilizados para atender esta solicitação.
              </small>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
export function PolicyPage({ slug }: { slug: string }) {
  const { data } = useShop();
  const map = {
    entrega: { title: "Envio e entrega", key: "shippingPolicy" },
    trocas: { title: "Trocas e devoluções", key: "returnPolicy" },
    privacidade: { title: "Política de privacidade", key: "privacyPolicy" },
    termos: { title: "Termos de compra", key: "terms" },
  } as const;
  const p = map[slug as keyof typeof map];
  if (!p) return null;
  const content = data.settings[p.key];
  return (
    <div className="container section policy-page">
      <Breadcrumb items={[{ label: p.title }]} />
      <div className="policy-layout">
        <aside>
          <h3>Informações da loja</h3>
          {Object.entries(map).map(([key, item]) => (
            <Link
              key={key}
              href={`/politicas/${key}`}
              className={key === slug ? "active" : ""}
            >
              {item.title}
              <ArrowRight size={14} />
            </Link>
          ))}
        </aside>
        <article>
          <Eyebrow>TRANSPARÊNCIA EM CADA ETAPA</Eyebrow>
          <h1>{p.title}</h1>
          {content ? (
            <div className="preserve-lines policy-content">{content}</div>
          ) : (
            <div className="notice">
              <h3>Estamos preparando esta informação.</h3>
              <p>
                Entre em contato com o atendimento para consultar esta informação.
              </p>
              {data.admin && (
                <LinkButton href="/admin/politicas" variant="outline">
                  Editar no painel
                  <ArrowRight size={16} />
                </LinkButton>
              )}
            </div>
          )}
          <div className="policy-company">
            <strong>{data.settings.legalName}</strong>
            <small>CNPJ {data.settings.cnpj}</small>
            <p>{data.settings.address}</p>
          </div>
          <WhatsApp label="Tire suas dúvidas com a equipe" />
        </article>
      </div>
    </div>
  );
}
