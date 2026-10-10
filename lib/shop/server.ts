import { env } from "cloudflare:workers";
import {
  supabaseDatabase,
  usesSupabase,
  migrateD1IfNeeded,
} from "@/db/supabase";
import type { StoreDatabase } from "@/db/store-database";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { defaultProducts, defaultSettings } from "./defaults";
import { digits, validDocument, cartSchema } from "./validation";
import type {
  StoreSettings,
  Product,
  CartItem,
  OrderItem,
  ShippingQuote,
  Order,
} from "./types";

export class ShopError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function db(): StoreDatabase {
  if (usesSupabase()) return supabaseDatabase();
  if (!env.DB)
    throw new ShopError(
      "Banco de dados indisponível. Tente novamente em instantes.",
      503,
    );
  return env.DB as unknown as StoreDatabase;
}
export const now = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();
export async function hash(s: string) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
  );
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
export async function seed() {
  const database = db();
  if (
    await database
      .prepare("SELECT key FROM settings WHERE key = 'store'")
      .first()
  )
    return;
  if (usesSupabase() && (await migrateD1IfNeeded())) return;
  await database.batch([
    ...defaultProducts.map((p) =>
      database
        .prepare(
          "INSERT OR IGNORE INTO products (id,slug,title,pieces,price,stock,active,featured,description,image,specs,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          p.id,
          p.slug,
          p.title,
          p.pieces,
          p.price,
          p.stock,
          p.active,
          p.featured,
          p.description,
          p.image,
          JSON.stringify(p.specs),
          now(),
        ),
    ),
    database
      .prepare("INSERT OR IGNORE INTO settings (key,data) VALUES ('store',?)")
      .bind(JSON.stringify(defaultSettings)),
  ]);
}
export async function getSettings(): Promise<StoreSettings> {
  const row = await db()
    .prepare("SELECT data FROM settings WHERE key='store'")
    .first<{ data: string }>();
  return { ...defaultSettings, ...JSON.parse(row?.data || "{}") };
}
export async function getProducts(all = false): Promise<Product[]> {
  const r = await db()
    .prepare(
      `SELECT * FROM products ${all ? "" : "WHERE active=1"} ORDER BY pieces ASC`,
    )
    .all<Record<string, unknown>>();
  return r.results.map(
    (p) => ({ ...p, specs: JSON.parse(p.specs as string) }) as Product,
  );
}
export async function isAdmin() {
  const user = await getChatGPTUser();
  if (!user) return false;
  if (import.meta.env.DEV && user.userId === "local_seedy") return true;
  return (env.ADMIN_EMAILS || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .includes(user.email.toLowerCase());
}
export async function requireAdmin() {
  if (!(await isAdmin()))
    throw new ShopError("Acesso restrito aos administradores da loja.", 403);
}
export function paymentEnvironment() {
  return (
    env.PAGARME_ENVIRONMENT ||
    (env.PAGARME_SECRET_KEY?.startsWith("sk_test") ? "test" : "production")
  );
}
export function sandboxEnabled(s: StoreSettings) {
  return (
    !s.salesEnabled &&
    s.demoEnabled &&
    !!env.PAGARME_SECRET_KEY &&
    paymentEnvironment() === "test"
  );
}
export async function claimGuestOrders(request: Request) {
  const user = await getChatGPTUser();
  const token = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)sm_guest=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!user || !token) return;
  const guestKey = `guest:${await hash(token)}`,
    userKey = `user:${user.userId}`;
  await db()
    .prepare(
      "UPDATE orders SET owner_key=?,user_id=? WHERE owner_key=? AND NOT EXISTS (SELECT 1 FROM orders AS existing WHERE existing.owner_key=? AND existing.request_key=orders.request_key)",
    )
    .bind(userKey, user.userId, guestKey, userKey)
    .run();
}
export function launchIssues(s: StoreSettings) {
  const issues: string[] = [];
  if (!env.PAGARME_SECRET_KEY) issues.push("Configurar chave Pagar.me");
  if (paymentEnvironment() !== "production")
    issues.push("Validar e ativar Pagar.me em produção");
  if (!s.legalName || !validDocument(s.cnpj, "company"))
    issues.push("Completar razão social e CNPJ válido");
  if (!s.email) issues.push("Definir e-mail de atendimento");
  if (!s.address || digits(s.originZip).length !== 8)
    issues.push("Completar endereço de origem dos envios");
  if (!s.shippingRules.some((r) => r.active))
    issues.push("Cadastrar ao menos uma regra de entrega");
  if (!s.inventoryConfirmed) issues.push("Conferir e confirmar estoque");
  if (!s.shippingPolicy || !s.returnPolicy || !s.privacyPolicy || !s.terms)
    issues.push("Publicar políticas e termos da loja");
  return issues;
}
export async function cartItems(input: unknown): Promise<{
  items: OrderItem[];
  subtotal: number;
  quantities: Map<string, number>;
}> {
  const parsed = cartSchema.parse(input),
    catalog = await getProducts();
  const items: OrderItem[] = [];
  const quantities = new Map<string, number>();
  for (const row of parsed) {
    const p = catalog.find((p) => p.id === row.productId);
    if (!p)
      throw new ShopError(
        "Um produto não está mais disponível. Atualize seu carrinho.",
        409,
      );
    if (Object.values(row.grade).reduce((a, b) => a + b, 0) !== p.pieces)
      throw new ShopError(
        `A grade de ${p.title} deve somar ${p.pieces} peças.`,
      );
    const count = (quantities.get(p.id) || 0) + row.quantity;
    if (count > 20)
      throw new ShopError("Máximo de 20 pacotes por produto em cada pedido.");
    quantities.set(p.id, count);
    items.push({
      ...row,
      title: p.title,
      pieces: p.pieces,
      price: p.price,
      image: p.image,
    });
  }
  const subtotal = items.reduce((v, p) => v + p.price * p.quantity, 0);
  if (subtotal > 100000000)
    throw new ShopError(
      "Para esse volume, solicite uma proposta pelo atendimento.",
    );
  return { items, subtotal, quantities };
}
export async function getDiscount(code: string, subtotal: number) {
  if (!code) return { amount: 0, code: null as string | null };
  const row = await db()
    .prepare("SELECT * FROM coupons WHERE code=?")
    .bind(code.trim().toUpperCase())
    .first<{
      code: string;
      kind: string;
      value: number;
      minimum: number;
      usage_limit: number;
      used: number;
      active: number;
      expires_at: string | null;
    }>();
  if (
    !row ||
    !row.active ||
    row.used >= row.usage_limit ||
    (row.expires_at && new Date(row.expires_at).getTime() < Date.now())
  )
    throw new ShopError("Cupom inválido, expirado ou esgotado.");
  if (subtotal < row.minimum)
    throw new ShopError(
      `Esse cupom exige compra mínima de ${(row.minimum / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
    );
  return {
    amount: Math.min(
      subtotal - 100,
      row.kind === "percent"
        ? Math.floor((subtotal * row.value) / 100)
        : row.value,
    ),
    code: row.code,
    snapshot: { kind: row.kind, value: row.value, minimum: row.minimum },
  };
}
export function shippingQuotes(
  s: StoreSettings,
  state: string,
  subtotal: number,
  demo = false,
): ShippingQuote[] {
  const rows = s.shippingRules
    .filter((r) => r.active && (!r.states.length || r.states.includes(state)))
    .map((r) => ({
      id: r.id,
      label: r.label,
      amount: r.freeAbove > 0 && subtotal >= r.freeAbove ? 0 : r.amount,
      minDays: r.minDays,
      maxDays: r.maxDays,
    }));
  if (!rows.length && demo)
    return [
      {
        id: "demo-delivery",
        label: "Entrega demonstrativa",
        amount: 0,
        minDays: 5,
        maxDays: 10,
        demo: true,
      },
    ];
  return rows;
}
export async function owner(request: Request) {
  const user = await getChatGPTUser();
  if (user)
    return { key: `user:${user.userId}`, userId: user.userId, cookie: null };
  const cookie = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)sm_guest=([a-f0-9]{64})(?:;|$)/)?.[1];
  const token =
    cookie || `${uid().replaceAll("-", "")}${uid().replaceAll("-", "")}`;
  return {
    key: `guest:${await hash(token)}`,
    userId: null,
    cookie: cookie
      ? null
      : `sm_guest=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`,
  };
}
export async function rateLimit(request: Request, scope: string, limit = 20) {
  const bucket = Math.floor(Date.now() / 60000);
  const identity =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("oai-authenticated-user-id") ||
    "local";
  const id = await hash(`${scope}:${identity}:${bucket}`);
  const r = await db()
    .prepare(
      "INSERT INTO rate_limits (id,count,expires_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count",
    )
    .bind(id, Date.now() + 120000)
    .first<{ count: number }>();
  if (r && r.count > limit)
    throw new ShopError(
      "Muitas tentativas. Aguarde um minuto e tente novamente.",
      429,
    );
  if (Math.random() < 0.05)
    await db()
      .prepare("DELETE FROM rate_limits WHERE expires_at<?")
      .bind(Date.now())
      .run();
}
export function decodeOrder(row: Record<string, unknown>): Order {
  const {
    owner_key,
    user_id,
    request_key,
    provider_link_id,
    provider_order_id,
    provider_environment,
    reserved,
    ...safe
  } = row;
  return {
    ...safe,
    sandbox: !row.demo && provider_environment === "test",
    payment_config: row.payment_config
      ? JSON.parse(row.payment_config as string)
      : undefined,
    items: JSON.parse(row.items as string),
    customer: JSON.parse(row.customer as string),
    address: JSON.parse(row.address as string),
    shipping: JSON.parse(row.shipping as string),
  } as Order;
}
export async function getOrder(id: string, request: Request, admin = false) {
  const who = await owner(request);
  const row = await db()
    .prepare(
      `SELECT * FROM orders WHERE id=? ${admin ? "" : "AND owner_key=?"}`,
    )
    .bind(...(admin ? [id] : [id, who.key]))
    .first<Record<string, unknown>>();
  if (!row)
    throw new ShopError(
      "Pedido não encontrado nesta conta ou neste navegador.",
      404,
    );
  const events = await db()
    .prepare(
      "SELECT * FROM order_events WHERE order_id=? ORDER BY created_at ASC",
    )
    .bind(id)
    .all<{ id: string; type: string; note: string; created_at: string }>();
  return { ...decodeOrder(row), events: events.results };
}
export async function event(
  orderId: string,
  type: string,
  note: string,
  eventId = uid(),
) {
  await db()
    .prepare(
      "INSERT OR IGNORE INTO order_events (id,order_id,type,note,created_at) VALUES (?,?,?,?,?)",
    )
    .bind(eventId, orderId, type, note, now())
    .run();
}
export function assertSameOrigin(request: Request) {
  if (!["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      throw new ShopError("Origem da requisição inválida.", 403);
    if (!request.headers.get("content-type")?.includes("application/json"))
      throw new ShopError("Envie dados em JSON.", 415);
  }
}
export async function jsonBody(request: Request) {
  const text = await request.text();
  if (text.length > 128000)
    throw new ShopError("Dados excedem o limite permitido.", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new ShopError("Dados inválidos.");
  }
}
