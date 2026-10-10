import { env } from "@/lib/env";
import statements from "./supabase-statements.json";
import type { StoreDatabase, StoreStatement } from "./store-database";

type Value = unknown;
type Row = Record<string, unknown>;
type Result<T = Row> = {
  results: T[];
  meta: { changes: number };
  success: true;
};
type Operation = { id: string; params: Value[] };
const normalize = (sql: string) => sql.trim().replace(/\s+/g, " ");
const queryIds = new Map(statements.map((s) => [normalize(s.sqlite), s.id]));
const jsonColumns = new Set([
  "data",
  "specs",
  "items",
  "customer",
  "address",
  "shipping",
  "payment_config",
]);

export function usesSupabase() {
  const provider =
    env.DATABASE_PROVIDER || "supabase";
  if (!["supabase", "d1"].includes(provider))
    throw new Error("DATABASE_PROVIDER inválido.");
  return provider === "supabase";
}

export function supabaseConfig() {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  const projectUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  if (!projectUrl || !key)
    throw new Error("Credenciais do Supabase não configuradas no servidor.");
  const url = new URL(projectUrl);
  if (env.NEXT_PUBLIC_SUPABASE_URL && new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin !== url.origin)
    throw new Error("As configurações do Supabase devem apontar para o mesmo projeto.");
  if (
    url.protocol !== "https:" ||
    !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error("SUPABASE_URL deve ser a URL HTTPS oficial do projeto.");
  return { url: url.origin, key };
}

export async function supabaseFetch(path: string, init: RequestInit = {}) {
  if (
    !/^\/(?:rest\/v1\/rpc\/sm_(?:database|import_d1)_v1$|storage\/v1\/bucket\/supermalhas-products$|storage\/v1\/object\/)/.test(
      path,
    )
  )
    throw new Error("Recurso Supabase inválido.");
  const { url, key } = supabaseConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  // New sb_secret keys are not JWTs. The API gateway resolves their server role.
  if (!key.startsWith("sb_secret_"))
    headers.set("Authorization", `Bearer ${key}`);
  else headers.delete("Authorization");
  return fetch(`${url}${path}`, {
    ...init,
    headers,
    signal: init.signal || AbortSignal.timeout(15000),
  });
}

function operation(query: string, values: Value[]): Operation {
  const sql = normalize(query),
    id = queryIds.get(sql);
  if (id) return { id, params: values };
  // The cart has a variable number of products. Send structured checks instead
  // of SQL to the database; the server-side RPC owns the fixed INSERT statement.
  if (sql.startsWith("INSERT INTO orders (id,number,owner_key,")) {
    const checks: Value[] = [];
    let offset = 21;
    const dryRun = !sql.includes("AND stock>=?");
    const matches =
      sql.match(
        /EXISTS \(SELECT 1 FROM products WHERE id=\? AND active=1 AND price=\? AND pieces=\?/g,
      ) || [];
    if (!matches.length || matches.length > 20)
      throw new Error("Condições do carrinho inválidas.");
    for (const _ of matches) {
      checks.push({
        productId: values[offset++],
        price: values[offset++],
        pieces: values[offset++],
        qty: dryRun ? null : values[offset++],
      });
    }
    const coupon = sql.includes("FROM coupons WHERE code=? AND kind=?")
      ? {
          code: values[offset++],
          kind: values[offset++],
          value: values[offset++],
          minimum: values[offset++],
          stamp: values[offset++],
        }
      : null;
    if (offset !== values.length)
      throw new Error("Parâmetros do carrinho inválidos.");
    return {
      id: "checkout_insert",
      params: [...values.slice(0, 21), checks, coupon],
    };
  }
  throw new Error(
    "Operação de banco não cadastrada. Atualize a migração Supabase.",
  );
}

function decodeRow(row: Row): Row {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      jsonColumns.has(key) && value !== null && typeof value === "object"
        ? JSON.stringify(value)
        : value,
    ]),
  );
}

class SupabaseStatement {
  constructor(
    readonly query: string,
    readonly params: Value[] = [],
  ) {}
  bind(...params: Value[]) {
    return new SupabaseStatement(this.query, params);
  }
  async all<T = Row>(): Promise<Result<T>> {
    return (await execute([this]))[0] as Result<T>;
  }
  async first<T = Row>(column?: string): Promise<T | null> {
    const row = (await this.all<Row>()).results[0];
    return (row ? (column ? row[column] : row) : null) as T | null;
  }
  async run<T = Row>(): Promise<Result<T>> {
    return this.all<T>();
  }
}

async function execute(items: SupabaseStatement[]): Promise<Result[]> {
  if (!items.length) return [];
  if (items.length > 100) throw new Error("Lote de banco excede o limite.");
  const response = await supabaseFetch("/rest/v1/rpc/sm_database_v1", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      operations: items.map((s) => operation(s.query, s.params)),
    }),
  });
  if (!response.ok) {
    // Never print provider payloads: they can contain customer data or SQL values.
    throw new Error(`Supabase recusou a operação (${response.status}).`);
  }
  const data = (await response.json()) as Result[];
  if (!Array.isArray(data) || data.length !== items.length)
    throw new Error("Resposta do Supabase inválida.");
  return data.map((r) => ({ ...r, results: r.results.map(decodeRow) }));
}

export function supabaseDatabase(): StoreDatabase {
  supabaseConfig();
  return {
    prepare: (sql: string) => new SupabaseStatement(sql),
    batch: (items: StoreStatement[]) => {
      if (!items.every((s) => s instanceof SupabaseStatement))
        throw new Error("Lote de banco inválido.");
      return execute(items as SupabaseStatement[]);
    },
  };
}

export async function migrateD1IfNeeded() {
  if (env.SUPABASE_MIGRATE_D1 !== "true" || !env.DB) return false;
  const source = await env.DB.prepare(
    "SELECT key FROM settings WHERE key='store'",
  ).first();
  if (!source) return false;
  const tables = [
    "products",
    "coupons",
    "orders",
    "order_events",
    "profiles",
    "contacts",
    "newsletter",
    "rate_limits",
    "settings",
  ];
  const results = await env.DB.batch(
    tables.map((table) =>
      env.DB!.prepare(`SELECT * FROM ${table} LIMIT 10001`),
    ),
  );
  const snapshot = Object.fromEntries(
    results.map((result, i) => {
      if (result.results.length > 10000)
        throw new Error(
          "Migração D1 exige exportação por lotes. Nenhum dado foi alterado.",
        );
      return [
        tables[i],
        result.results.map((row) =>
          Object.fromEntries(
            Object.entries(row).map(([key, value]) => [
              key,
              jsonColumns.has(key) && typeof value === "string"
                ? JSON.parse(value)
                : value,
            ]),
          ),
        ),
      ];
    }),
  );
  const response = await supabaseFetch("/rest/v1/rpc/sm_import_d1_v1", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ snapshot }),
  });
  if (!response.ok)
    throw new Error(
      `Migração D1 recusada pelo Supabase (${response.status}). Nenhum dado de origem foi alterado.`,
    );
  return true;
}
