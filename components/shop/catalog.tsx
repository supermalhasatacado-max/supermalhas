"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  SlidersHorizontal,
  Check,
  Diamond,
  Truck,
  ShieldCheck,
  ShoppingBag,
  Ruler,
  Heart,
  ChevronRight,
  X,
  Search,
} from "lucide-react";
import { useShop, api } from "./context";
import {
  ProductCard,
  Breadcrumb,
  Eyebrow,
  Benefits,
  Button,
  LinkButton,
  Quantity,
  WhatsApp,
  Modal,
  Field,
  ErrorBox,
  Empty,
} from "./ui";
import { balancedGrade, money } from "@/lib/shop/types";
import type { Product, Grade, ShippingQuote } from "@/lib/shop/types";
export function Catalog() {
  const { data } = useShop(),
    params = useSearchParams();
  const [sort, setSort] = useState("featured"),
    [sizes, setSizes] = useState<string[]>([]),
    [amounts, setAmounts] = useState<number[]>([]),
    [filters, setFilters] = useState(false);
  const q = params.get("q") || "";
  const products = data.products
    .filter(
      (p) =>
        (!q ||
          `${p.title} malha peruana branco atacado ${p.pieces}`
            .toLowerCase()
            .includes(q.toLowerCase())) &&
        (!amounts.length || amounts.includes(p.pieces)),
    )
    .sort((a, b) =>
      sort === "price-asc"
        ? a.price - b.price
        : sort === "price-desc"
          ? b.price - a.price
          : sort === "pieces"
            ? a.pieces - b.pieces
            : b.featured - a.featured || a.pieces - b.pieces,
    );
  return (
    <>
      <section className="catalog-hero">
        <div className="container">
          <Eyebrow>O BÁSICO QUE MOVE SEU NEGÓCIO</Eyebrow>
          <h1>
            Camisetas <span>malha peruana.</span>
          </h1>
          <p>A mesma qualidade. O volume que você precisa.</p>
        </div>
      </section>
      <div className="container section catalog-section">
        <Breadcrumb items={[{ label: "Camisetas" }]} />
        <div className="catalog-layout">
          <aside className={`filters ${filters ? "show" : ""}`}>
            <div className="filter-title">
              <h3>Refine sua escolha</h3>
              <button
                className="icon-button"
                aria-label="Fechar filtros"
                onClick={() => setFilters(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="filter-group">
              <h4>Categoria</h4>
              <Link href="/camisetas" className="category-active">
                Camisetas brancas <ChevronRight size={14} />
              </Link>
              <p>Malha peruana</p>
              <p>Atacado</p>
            </div>
            <div className="filter-group">
              <h4>Quantidade por pacote</h4>
              {data.products.map((p) => (
                <label className="check-control" key={p.id}>
                  <input
                    type="checkbox"
                    checked={amounts.includes(p.pieces)}
                    onChange={(e) =>
                      setAmounts(
                        e.target.checked
                          ? [...amounts, p.pieces]
                          : amounts.filter((n) => n !== p.pieces),
                      )
                    }
                  />
                  {p.pieces} peças
                </label>
              ))}
            </div>
            <div className="filter-group">
              <h4>Tamanhos disponíveis</h4>
              <div className="size-chips">
                {["P", "M", "G", "GG"].map((size) => (
                  <button
                    key={size}
                    onClick={() =>
                      setSizes(
                        sizes.includes(size)
                          ? sizes.filter((s) => s !== size)
                          : [...sizes, size],
                      )
                    }
                    className={sizes.includes(size) ? "selected" : ""}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <small>Todos os pacotes permitem combinar esses tamanhos.</small>
            </div>
            <div className="filter-group">
              <h4>Cor</h4>
              <span className="color-option">
                <i /> Branco
              </span>
            </div>
            <Button
              variant="plain"
              onClick={() => {
                setSizes([]);
                setAmounts([]);
              }}
              className="full"
            >
              Limpar filtros
            </Button>
            <div className="filter-help">
              <Diamond size={25} />
              <h4>Uma boa compra começa aqui.</h4>
              <p>Precisa escolher seu primeiro pacote?</p>
              <WhatsApp label="Conte com a gente" variant="outline" />
            </div>
          </aside>
          <div>
            <div className="catalog-toolbar">
              <div>
                <h2>{q ? `Busca por “${q}”` : "Escolha seu pacote"}</h2>
                <span className="muted small">
                  {products.length}{" "}
                  {products.length === 1
                    ? "pacote encontrado"
                    : "pacotes encontrados"}
                </span>
              </div>
              <div>
                <button
                  className="btn outline filter-trigger"
                  onClick={() => setFilters(!filters)}
                >
                  <SlidersHorizontal size={16} />
                  Filtros
                </button>
                <label className="sort-label">
                  Ordenar por
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="featured">Destaques</option>
                    <option value="price-asc">Menor preço</option>
                    <option value="price-desc">Maior preço</option>
                    <option value="pieces">Quantidade de peças</option>
                  </select>
                </label>
              </div>
            </div>
            {products.length ? (
              <div className="product-grid">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            ) : (
              <Empty icon={Search} title="Nenhum pacote encontrado">
                <p>Tente buscar por “camisetas” ou ajustar os filtros.</p>
                <LinkButton href="/camisetas">Ver todos os pacotes</LinkButton>
              </Empty>
            )}
          </div>
        </div>
        <Benefits />
      </div>
    </>
  );
}
export function ProductPage({ slug }: { slug: string }) {
  const { data, add } = useShop();
  const p = data.products.find((p) => p.slug === slug);
  return p ? (
    <ProductDetail key={p.id} p={p} />
  ) : (
    <div className="container section">
      <Empty title="Produto não encontrado">
        <p>Esse pacote pode ter saído do catálogo.</p>
        <LinkButton href="/camisetas">Voltar ao catálogo</LinkButton>
      </Empty>
    </div>
  );
}
function ProductDetail({ p }: { p: Product }) {
  const { data, add, toast } = useShop();
  const [grade, setGrade] = useState<Grade>(balancedGrade(p.pieces)),
    [qty, setQty] = useState(1),
    [tab, setTab] = useState("description"),
    [image, setImage] = useState(0),
    [sizeModal, setSizeModal] = useState(false),
    [zoom, setZoom] = useState(false),
    [zip, setZip] = useState(""),
    [shipping, setShipping] = useState<ShippingQuote[]>([]),
    [shippingError, setShippingError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      setSaved(
        (
          JSON.parse(localStorage.getItem("sm-wishlist") || "[]") as string[]
        ).includes(p.id),
      );
    } catch {}
  }, [p.id]);
  const total = Object.values(grade).reduce((a, b) => a + b, 0),
    available = p.stock > 0;
  const closeSizes = useCallback(() => setSizeModal(false), []),
    closeZoom = useCallback(() => setZoom(false), []);
  return (
    <div className="container product-page section">
      <Breadcrumb
        items={[
          { label: "Camisetas", href: "/camisetas" },
          { label: `Pacote de ${p.pieces} peças` },
        ]}
      />
      <div className="product-detail-grid">
        <div className="product-gallery">
          <button
            className="gallery-main"
            onClick={() => setZoom(true)}
            aria-label="Ampliar imagem do produto"
          >
            <img
              src={image === 2 ? "/images/hero.png" : p.image}
              alt={`Pacote de camisetas brancas${image === 1 ? ", detalhe da gola" : ""}`}
              className={image === 1 ? "detail-image" : ""}
            />
            <span>Imagem ilustrativa · Clique para ampliar</span>
          </button>
          <div className="gallery-thumbs">
            {["O pacote", "Detalhe da malha", "Em grande escala"].map(
              (t, i) => (
                <button
                  aria-label={t}
                  aria-pressed={image === i}
                  onClick={() => setImage(i)}
                  className={image === i ? "selected" : ""}
                  key={t}
                >
                  <img
                    src={i === 2 ? "/images/hero.png" : p.image}
                    className={i === 1 ? "detail-image" : ""}
                    alt={t}
                  />
                </button>
              ),
            )}
          </div>
        </div>
        <div className="product-info">
          <div className="product-top-line">
            <span className="label-pill">
              {p.featured ? "PACOTE EM DESTAQUE" : "ATACADO"} · {p.pieces} PEÇAS
            </span>
            <button
              className={`icon-button ${saved ? "saved" : ""}`}
              aria-label={
                saved ? "Remover dos favoritos" : "Salvar nos favoritos"
              }
              onClick={() => {
                let list: string[] = [];
                try {
                  list = JSON.parse(
                    localStorage.getItem("sm-wishlist") || "[]",
                  );
                } catch {}
                list = saved
                  ? list.filter((id) => id !== p.id)
                  : [...list, p.id];
                localStorage.setItem("sm-wishlist", JSON.stringify(list));
                setSaved(!saved);
                toast(
                  saved
                    ? "Produto removido dos favoritos."
                    : "Produto salvo. Veja seus favoritos na Minha conta.",
                );
              }}
            >
              <Heart size={20} fill={saved ? "currentColor" : "none"} />
            </button>
          </div>
          <h1>
            {p.title}
            <span>Malha Peruana</span>
          </h1>
          <p className="product-subtitle">
            O básico que abre possibilidades para o seu negócio.
          </p>
          <div className="product-price">{money(p.price)}</div>
          <p className="unit-price">
            {money(p.price / p.pieces)} por peça <span>·</span> Até{" "}
            {data.settings.maxInstallments}x no cartão
          </p>
          <div className={`stock-state ${!available ? "unavailable" : ""}`}>
            <i />
            {p.stock > 0
                  ? `${p.stock} pacotes disponíveis`
                  : "Indisponível no momento"}
          </div>
          <div className="grade-section">
            <div>
              <h3>Monte sua grade</h3>
              <button className="text-link" onClick={() => setSizeModal(true)}>
                <Ruler size={15} />
                Guia de tamanhos
              </button>
            </div>
            <p>Distribua as {p.pieces} peças entre os tamanhos.</p>
            <div className="grade-inputs">
              {(["P", "M", "G", "GG"] as const).map((size) => (
                <label key={size}>
                  <b>{size}</b>
                  <input
                    type="number"
                    min={0}
                    max={p.pieces}
                    step={1}
                    value={grade[size]}
                    aria-label={`Peças tamanho ${size}`}
                    onChange={(e) =>
                      setGrade({
                        ...grade,
                        [size]: Math.max(
                          0,
                          Math.min(p.pieces, parseInt(e.target.value) || 0),
                        ),
                      })
                    }
                  />
                  <small>peças</small>
                </label>
              ))}
            </div>
            <div
              className={`grade-total ${total === p.pieces ? "valid" : "invalid"}`}
            >
              <span>
                {total === p.pieces ? <Check size={15} /> : null}
                {total} de {p.pieces} peças
              </span>
              <button onClick={() => setGrade(balancedGrade(p.pieces))}>
                Distribuir igualmente
              </button>
            </div>
            {total !== p.pieces && (
              <p className="field-error">
                {total < p.pieces
                  ? `Faltam ${p.pieces - total} peças para completar o pacote.`
                  : `Remova ${total - p.pieces} peças da grade.`}
              </p>
            )}
          </div>
          <div className="product-add">
            <Quantity
              value={qty}
              onChange={(n) =>
                setQty(
                  Math.max(
                    1,
                    Math.min(p.stock, n),
                  ),
                )
              }
              max={p.stock}
            />
            <Button
              className="grow"
              disabled={total !== p.pieces || !available}
              onClick={() => add(p, grade, qty)}
            >
              <ShoppingBag size={19} />
              Adicionar ao carrinho
            </Button>
          </div>
          <WhatsApp
            label="Converse sobre este pacote"
            message={`Olá! Gostaria de saber mais sobre o pacote de ${p.pieces} camisetas.`}
            variant="outline"
          />
          <div className="product-trust">
            <span>
              <ShieldCheck size={17} />
              Pagamento protegido
            </span>
            <span>
              <Truck size={17} />
              Entrega com rastreio
            </span>
          </div>
          <form
            className="shipping-estimator"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setShippingError("");
              try {
                const address = await api(`cep/${zip.replace(/\D/g, "")}`);
                const result = await api("quote", {
                  items: [{ productId: p.id, grade, quantity: qty }],
                  state: address.state,
                });
                setShipping(result.shipping);
                if (!result.shipping.length)
                  setShippingError(
                    "Ainda não há entrega configurada para essa região. Entre em contato.",
                  );
              } catch (e) {
                setShippingError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label htmlFor="product-cep">
              <Truck size={16} />
              Calcule a entrega
            </label>
            <div>
              <input
                id="product-cep"
                inputMode="numeric"
                required
                pattern="[0-9-]{8,9}"
                placeholder="Seu CEP"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                maxLength={9}
              />
              <Button variant="outline" busy={busy}>
                Calcular
              </Button>
            </div>
            {shipping.map((r) => (
              <p key={r.id}>
                <strong>
                  {r.label} · {r.toArrange ? "A combinar" : money(r.amount)}
                </strong>
                <small>
                  {r.toArrange ? "Valor e prazo combinados com o SAC antes do pagamento. Frete pago à parte." : `${r.minDays} a ${r.maxDays} dias úteis após postagem`}
                </small>
              </p>
            ))}
            <ErrorBox message={shippingError} />
          </form>
        </div>
      </div>
      <section className="product-tabs">
        <div role="tablist" aria-label="Detalhes do produto">
          {[
            { id: "description", title: "Sobre o produto" },
            { id: "specs", title: "Especificações" },
            { id: "delivery", title: "Envio e entrega" },
          ].map((t) => (
            <button
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              className={tab === t.id ? "active" : ""}
              key={t.id}
              onClick={() => setTab(t.id)}
            >
              {t.title}
            </button>
          ))}
        </div>
        <div id={`panel-${tab}`} role="tabpanel">
          {tab === "description" ? (
            <>
              <h3>Uma boa base para o seu próximo projeto.</h3>
              <p>{p.description}</p>
              <div className="product-description-points">
                <span>
                  <Diamond size={22} />
                  Malha peruana
                </span>
                <span>
                  <Check size={22} />
                  Branca e versátil
                </span>
                <span>
                  <ShoppingBag size={22} />
                  {p.pieces} peças por pacote
                </span>
              </div>
            </>
          ) : tab === "specs" ? (
            <dl>
              {Object.entries(p.specs).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <>
              <p>
                {data.settings.shippingPolicy ||
                  "Consulte nossa equipe para combinar as condições de entrega para o seu endereço."}
              </p>
              <Link href="/politicas/entrega" className="text-link">
                Ver política de entrega <ArrowRight size={15} />
              </Link>
            </>
          )}
        </div>
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <Eyebrow>ENCONTRE O VOLUME IDEAL</Eyebrow>
            <h2>Outras possibilidades para você.</h2>
          </div>
        </div>
        <div className="product-grid">
          {data.products
            .filter((i) => i.id !== p.id)
            .map((i) => (
              <ProductCard key={i.id} product={i} />
            ))}
        </div>
      </section>
      {sizeModal && (
        <Modal title="Guia de tamanhos" onClose={closeSizes}>
          {data.settings.sizeChart.length ? (
            <div className="modal-content">
              <p>
                Medidas publicadas pela Super Malhas. Valores em centímetros.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Tamanho</th>
                    <th>Largura</th>
                    <th>Comprimento</th>
                  </tr>
                </thead>
                <tbody>
                  {data.settings.sizeChart.map((s) => (
                    <tr key={s.size}>
                      <td>{s.size}</td>
                      <td>{s.width} cm</td>
                      <td>{s.height} cm</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="modal-content">
              <p>
                Os tamanhos disponíveis são P, M, G e GG. A tabela de medidas
                será publicada antes da abertura das vendas.
              </p>
              <WhatsApp label="Tire dúvidas sobre os tamanhos" />
            </div>
          )}
        </Modal>
      )}
      {zoom && (
        <Modal
          title="Camisetas brancas · Imagem ilustrativa"
          onClose={closeZoom}
          wide
        >
          <img
            src={image === 2 ? "/images/hero.png" : p.image}
            alt="Imagem ampliada das camisetas"
            className="zoom-image"
          />
        </Modal>
      )}
    </div>
  );
}
