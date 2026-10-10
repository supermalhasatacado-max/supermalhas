"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import type { Bootstrap, CartItem, Product, Grade } from "@/lib/shop/types";
import { balancedGrade } from "@/lib/shop/types";
import { defaultProducts, defaultSettings } from "@/lib/shop/defaults";
export async function api<T = any>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/shop/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data: any = await response
    .json()
    .catch(() => ({ error: "Resposta indisponível." }));
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir.");
  return data as T;
}
type Context = {
  data: Bootstrap;
  loading: boolean;
  error: string;
  cart: CartItem[];
  ready: boolean;
  coupon: string;
  setCoupon: (s: string) => void;
  refresh: () => Promise<void>;
  add: (p: Product, grade?: Grade, quantity?: number) => void;
  change: (index: number, qty: number) => void;
  remove: (index: number) => void;
  clear: () => void;
  toast: (s: string) => void;
  drawer: boolean;
  setDrawer: (v: boolean) => void;
};
const ShopContext = createContext<Context>(null!);
const fallback: Bootstrap = {
  products: defaultProducts,
  settings: defaultSettings,
  user: null,
  admin: false,
  paymentReady: false,
  paymentEnvironment: "production",
  emailReady: false,
  launchIssues: [],
  demo: true,
};
export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Bootstrap>(fallback),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [cart, setCart] = useState<CartItem[]>([]),
    [coupon, setCoupon] = useState(""),
    [ready, setReady] = useState(false),
    [message, setMessage] = useState(""),
    [drawer, setDrawer] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setData(await api("bootstrap"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
    try {
      const items = JSON.parse(localStorage.getItem("sm-cart-v1") || "[]");
      if (Array.isArray(items))
        setCart(
          items.filter(
            (i) =>
              typeof i.productId === "string" &&
              Number.isInteger(i.quantity) &&
              i.quantity > 0 &&
              i.quantity <= 20 &&
              i.grade &&
              Object.values(i.grade).every(
                (n) => Number.isInteger(n) && Number(n) >= 0,
              ),
          ),
        );
      setCoupon(localStorage.getItem("sm-coupon-v1") || "");
    } catch {}
    setReady(true);
  }, [refresh]);
  useEffect(() => {
    if (ready) {
      localStorage.setItem("sm-cart-v1", JSON.stringify(cart));
      localStorage.setItem("sm-coupon-v1", coupon);
    }
  }, [cart, coupon, ready]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 4500);
    return () => clearTimeout(t);
  }, [message]);
  const add = (p: Product, grade = balancedGrade(p.pieces), quantity = 1) => {
    const available = data.demo || data.sandbox ? 20 : Math.min(20, p.stock);
    const previous = cart
      .filter((i) => i.productId === p.id)
      .reduce((n, i) => n + i.quantity, 0);
    if (previous + quantity > available) {
      setMessage(
        data.demo
          ? "Máximo de 20 pacotes deste produto."
          : "Quantidade superior ao estoque disponível.",
      );
      return;
    }
    setCart((rows) => {
      const index = rows.findIndex(
        (i) =>
          i.productId === p.id &&
          JSON.stringify(i.grade) === JSON.stringify(grade),
      );
      if (index < 0) return [...rows, { productId: p.id, grade, quantity }];
      return rows.map((i, n) =>
        n === index ? { ...i, quantity: i.quantity + quantity } : i,
      );
    });
    setDrawer(true);
  };
  return (
    <ShopContext.Provider
      value={{
        data,
        loading,
        error,
        cart,
        ready,
        coupon,
        setCoupon,
        refresh,
        add,
        change: (index, qty) => {
          if (qty < 1 || qty > 20) return;
          const p = data.products.find((p) => p.id === cart[index]?.productId);
          const others = cart
            .filter((i, n) => n !== index && i.productId === p?.id)
            .reduce((v, i) => v + i.quantity, 0);
          if (p && !data.demo && !data.sandbox && others + qty > p.stock) {
            setMessage("Quantidade superior ao estoque disponível.");
            return;
          }
          setCart((rows) =>
            rows.map((i, n) => (n === index ? { ...i, quantity: qty } : i)),
          );
        },
        remove: (index) =>
          setCart((rows) => rows.filter((_, n) => n !== index)),
        clear: () => {
          setCart([]);
          setCoupon("");
        },
        toast: setMessage,
        drawer,
        setDrawer,
      }}
    >
      {children}
      {message && (
        <div className="toast" role="status">
          {message}
          <button onClick={() => setMessage("")} aria-label="Fechar aviso">
            ×
          </button>
        </div>
      )}
    </ShopContext.Provider>
  );
}
export const useShop = () => useContext(ShopContext);
