"use client";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Diamond,
  ShieldCheck,
  Store,
  Shirt,
  Paintbrush,
  Gift,
  ChevronDown,
  Layers,
  PackageCheck,
} from "lucide-react";
import { useShop } from "./context";
import { money } from "@/lib/shop/types";
import { ProductCard, Benefits, Eyebrow, LinkButton, WhatsApp } from "./ui";
export function Home() {
  const { data } = useShop();
  const minimum = data.products.length
    ? Math.min(...data.products.map((p) => p.pieces))
    : 200;
  const unitPrice = data.products.length
    ? Math.min(...data.products.map((p) => Math.round(p.price / p.pieces)))
    : 2500;
  return (
    <>
      <section className="hero">
        <img
          src="/images/hero.png"
          alt="Camisetas brancas em malha peruana em um ambiente de atacado"
          className="hero-image"
          fetchPriority="high"
        />
        <div className="hero-shade" />
        <div className="container hero-content">
          <div className="hero-copy">
            <Eyebrow>DA NOSSA MALHA AO SEU SUCESSO</Eyebrow>
            <h1>
              Qualidade que veste.
              <br />
              <span>
                Atacado que faz
                <br />
                seu negócio crescer.
              </span>
            </h1>
            <p>
              Camisetas brancas em malha peruana.
              <br />A escolha certa para revender, uniformizar e criar.
            </p>
            <div className="hero-actions">
              <LinkButton href="/camisetas">
                Escolha seu pacote <ArrowRight size={19} />
              </LinkButton>
              <Link href="/atacado" className="hero-secondary">
                Conheça o atacado <ArrowUpRight size={18} />
              </Link>
            </div>
            <div className="hero-points">
              <span>
                <Diamond size={19} /> Malha peruana
              </span>
              <span>
                <Layers size={19} /> P, M, G e GG
              </span>
              <span>
                <ShieldCheck size={19} /> Compra protegida
              </span>
            </div>
          </div>
          <div className="hero-price-note">
            <span>A PARTIR DE</span>
            <strong>
              {money(unitPrice)}
              <small>/peça</small>
            </strong>
            <span>PACOTES A PARTIR DE {minimum} PEÇAS</span>
          </div>
        </div>
        <div className="hero-bottom">
          <span>FEITO PARA QUEM PENSA GRANDE.</span>
          <Link href="#pacotes">
            Encontre o seu pacote <ChevronDown size={15} />
          </Link>
        </div>
      </section>
      <div className="container">
        <Benefits />
      </div>
      <section className="section packages-section" id="pacotes">
        <div className="container">
          <div className="section-heading">
            <div>
              <Eyebrow>O PRÓXIMO PASSO DO SEU NEGÓCIO</Eyebrow>
              <h2>
                Mais peças. <span>Mais possibilidades.</span>
              </h2>
              <p>
                Escolha o volume ideal. A qualidade é a mesma em cada pacote.
              </p>
            </div>
            <Link href="/camisetas" className="text-link">
              Ver todos os pacotes <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="product-grid">
            {data.products.slice(0, 3).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          <div className="package-bottom">
            <PackageCheck size={20} />
            <p>
              Uma base para muitas ideias. Todos os pacotes são de camisetas
              brancas, com grade personalizável.
            </p>
            <Link href="/atacado">
              Qual pacote escolher? <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>
      <section className="quality-section">
        <div className="quality-image">
          <img
            src="/images/camisetas.png"
            alt="Detalhe da gola e textura das camisetas brancas"
            loading="lazy"
          />
          <span className="quality-stamp">
            <Diamond size={25} />O BÁSICO
            <br />
            <b>EM OUTRO NÍVEL.</b>
          </span>
        </div>
        <div className="quality-copy">
          <Eyebrow>SINTA A DIFERENÇA</Eyebrow>
          <h2>
            O seu produto começa
            <br />
            com uma <span>boa malha.</span>
          </h2>
          <p>
            Toque macio, caimento versátil e uma tela em branco para as suas
            ideias. Malha peruana para quem cuida de cada detalhe.
          </p>
          <div className="quality-features">
            <span>
              <Shirt size={22} />
              <b>Conforto no dia a dia</b>
              <small>Toque suave e modelagem unissex.</small>
            </span>
            <span>
              <Paintbrush size={22} />
              <b>Pronta para criar</b>
              <small>Uma base para estampar e personalizar.</small>
            </span>
          </div>
          <LinkButton href="/camisetas" variant="dark">
            Conheça as camisetas <ArrowRight size={18} />
          </LinkButton>
        </div>
      </section>
      <section className="section uses-section">
        <div className="container">
          <div className="section-heading centered">
            <Eyebrow>UM PRODUTO. MUITAS OPORTUNIDADES.</Eyebrow>
            <h2>Qual é o próximo capítulo da sua marca?</h2>
            <p>Da primeira coleção ao próximo grande pedido.</p>
          </div>
          <div className="uses-grid">
            {[
              {
                icon: Store,
                no: "01",
                title: "Revenda",
                text: "Abasteça sua loja com um básico que combina com tudo.",
              },
              {
                icon: Shirt,
                no: "02",
                title: "Uniformes",
                text: "Vista sua equipe com conforto e identidade.",
              },
              {
                icon: Paintbrush,
                no: "03",
                title: "Personalização",
                text: "Dê vida às suas ideias em uma base branca e versátil.",
              },
              {
                icon: Gift,
                no: "04",
                title: "Eventos e brindes",
                text: "Transforme cada peça em uma lembrança da sua marca.",
              },
            ].map(({ icon: Icon, no, title, text }) => (
              <Link href="/camisetas" className="use-card" key={no}>
                <div>
                  <Icon size={30} strokeWidth={1.3} />
                  <span>{no}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                <ArrowUpRight size={21} />
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="business-cta container">
        <div>
          <Eyebrow>CRESÇA COM A SUPER MALHAS</Eyebrow>
          <h2>
            Seu próximo grande pedido
            <br />
            começa com uma conversa.
          </h2>
          <p>
            Precisa de ajuda para escolher? Vamos encontrar o pacote para o seu
            negócio.
          </p>
        </div>
        <WhatsApp label="Falar com nossa equipe" variant="primary" />
      </section>
      <section className="section faq-section container">
        <div>
          <Eyebrow>COMPRA SIMPLES, DO INÍCIO AO FIM</Eyebrow>
          <h2>Vamos tirar suas dúvidas?</h2>
          <Link href="/contato" className="text-link">
            Visite a central de atendimento <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="faq-list">
          {[
            {
              q: "Qual é a quantidade mínima?",
              a: `Os pacotes começam em ${minimum} camisetas. Consulte os volumes e preços disponíveis no catálogo. O valor por peça começa em ${money(unitPrice)}.`,
            },
            {
              q: "Posso escolher os tamanhos?",
              a: "Sim. Na página do produto, defina quantas peças deseja em P, M, G e GG. A soma deve corresponder à quantidade do pacote. A grade escolhida fica registrada no seu pedido.",
            },
            {
              q: "Como funciona o pagamento?",
              a: `O pagamento é processado pelo Pagar.me. Você pode escolher Pix, boleto ou cartão em até ${data.settings.maxInstallments} parcelas. Os valores e eventuais juros são apresentados antes do pagamento.`,
            },
            {
              q: "Como calculo o frete?",
              a: "Informe seu CEP e endereço no checkout. As opções, valores e prazos disponíveis para a sua região aparecem na etapa de entrega.",
            },
          ].map(({ q, a }) => (
            <details key={q}>
              <summary>
                {q}
                <ChevronDown size={18} />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
