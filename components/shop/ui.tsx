"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  ShoppingBag,
  Truck,
  ShieldCheck,
  Package,
  CreditCard,
  Minus,
  Plus,
  X,
  MessageCircle,
  ChevronRight,
  Shirt,
  Award,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";
import type { Product, Grade } from "@/lib/shop/types";
import { money } from "@/lib/shop/types";
import { useShop } from "./context";
import { useEffect, useRef } from "react";
export function Button({
  children,
  variant = "primary",
  className = "",
  busy = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: string;
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`btn ${variant} ${className}`}
    >
      {busy ? <LoaderCircle size={19} className="spin" /> : null}
      {children}
    </button>
  );
}
export function LinkButton({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  variant?: string;
  className?: string;
}) {
  return (
    <Link href={href} className={`btn ${variant} ${className}`}>
      {children}
    </Link>
  );
}
export function ErrorBox({ message }: { message: string }) {
  return message ? (
    <div className="notice error" role="alert">
      <AlertCircle size={19} />
      <span>{message}</span>
    </div>
  ) : null;
}
export function Empty({
  icon: Icon = ShoppingBag,
  title,
  children,
}: {
  icon?: typeof ShoppingBag;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={38} strokeWidth={1.4} />
      </span>
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export function Breadcrumb({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav aria-label="Você está aqui" className="breadcrumb">
      <Link href="/">Início</Link>
      {items.map((item, i) => (
        <span key={i}>
          <ChevronRight size={13} />
          {item.href ? <Link href={item.href}>{item.label}</Link> : item.label}
        </span>
      ))}
    </nav>
  );
}
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="eyebrow">
      <i />
      {children}
    </span>
  );
}
export function WhatsApp({
  label = "Fale com a gente",
  variant = "outline",
  message = "Olá! Quero saber mais sobre os pacotes de camisetas.",
}: {
  label?: string;
  variant?: string;
  message?: string;
}) {
  const { data } = useShop();
  const number = data.settings.whatsapp.replace(/\D/g, "");
  const full = number.length <= 11 ? "55" + number : number;
  return number ? (
    <a
      className={`btn ${variant}`}
      href={`https://wa.me/${full}?text=${encodeURIComponent(message)}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <MessageCircle size={18} />
      {label}
      <ArrowUpRight size={15} />
    </a>
  ) : (
    <LinkButton href="/contato" variant={variant}>
      <MessageCircle size={18} />
      {label}
    </LinkButton>
  );
}
export function Benefits({ compact = false }: { compact?: boolean }) {
  const { data } = useShop();
  return (
    <div className={`benefits ${compact ? "compact" : ""}`}>
      {[
        {
          icon: Award,
          title: "Qualidade em cada peça",
          text: "Malha peruana e toque macio",
        },
        {
          icon: Truck,
          title: "Entrega para o seu negócio",
          text: "Consulte as condições de frete no checkout",
        },
        {
          icon: Package,
          title: "Atacado de verdade",
          text: "Pacotes a partir de 200 peças",
        },
        {
          icon: ShieldCheck,
          title: "Pagamento protegido",
          text: "Processado pelo Pagar.me",
        },
      ].map(({ icon: Icon, title, text }) => (
        <div key={title}>
          <Icon size={30} strokeWidth={1.5} />
          <span>
            <strong>{title}</strong>
            <small>{text}</small>
          </span>
        </div>
      ))}
    </div>
  );
}
export function Quantity({
  value,
  onChange,
  max = 20,
  label = "Quantidade de pacotes",
}: {
  value: number;
  onChange: (n: number) => void;
  max?: number;
  label?: string;
}) {
  return (
    <div className="quantity" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        aria-label="Diminuir quantidade"
      >
        <Minus size={15} />
      </button>
      <span aria-live="polite">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label="Aumentar quantidade"
      >
        <Plus size={15} />
      </button>
    </div>
  );
}
export function ProductCard({ product: p }: { product: Product }) {
  const { data } = useShop();
  return (
    <article className={`product-card ${p.featured ? "featured" : ""}`}>
      <Link href={`/produto/${p.slug}`} className="product-visual">
        <img
          src={p.image}
          alt={`Camisetas brancas em malha peruana, pacote de ${p.pieces} peças`}
          loading="lazy"
        />
        <span className="pieces-label">
          <b>{p.pieces}</b>PEÇAS
        </span>
        {p.featured ? (
          <span className="product-badge">PACOTE EM DESTAQUE</span>
        ) : null}
        <span className="see-product">
          Conhecer o pacote <ArrowUpRight size={18} />
        </span>
      </Link>
      <div className="product-body">
        <span className="micro muted">BRANCA · UNISSEX · P AO GG</span>
        <Link href={`/produto/${p.slug}`}>
          <h3>
            {p.title}
            <span>Malha Peruana</span>
          </h3>
        </Link>
        <div className="card-price">
          {money(p.price)}
          <span>{money(p.price / p.pieces)} por peça</span>
        </div>
        <ul className="check-list">
          <li>
            <Check size={15} />
            Grade de tamanhos à sua escolha
          </li>
          <li>
            <Check size={15} />
            Para revenda e personalização
          </li>
        </ul>
        <LinkButton href={`/produto/${p.slug}`} className="full">
          Escolher meu pacote <ArrowRight size={18} />
        </LinkButton>
        <div className="card-footer">
          <ShieldCheck size={13} /> Compra protegida <span>·</span>{" "}
          <CreditCard size={13} /> Até {data.settings.maxInstallments}x
        </div>
      </div>
    </article>
  );
}
export function GradeSummary({ grade }: { grade: Grade }) {
  return (
    <span className="grade-summary">
      {Object.entries(grade)
        .filter(([, n]) => n > 0)
        .map(([size, n]) => `${size}: ${n}`)
        .join(" · ")}
    </span>
  );
}
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const focusables = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button,a,input,select,textarea,[tabindex="0"]',
          ) || [],
        ).filter((el) => !el.hasAttribute("disabled"));
        if (!focusables.length) return;
        const first = focusables[0],
          last = focusables.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", fn);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", fn);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <header>
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Fechar janela"
          >
            <X />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
export function Field({
  label,
  children,
  required = false,
  hint = "",
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span>
        {label}
        {required && <em>*</em>}
      </span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
