import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { build } from "esbuild";
const sql = new DatabaseSync(":memory:");
for (const file of readdirSync("drizzle")
  .filter((f) => f.endsWith(".sql"))
  .sort())
  sql.exec(readFileSync(`drizzle/${file}`, "utf8"));
class Statement {
  constructor(query) {
    this.query = query;
    this.params = [];
  }
  bind(...params) {
    this.params = params;
    return this;
  }
  first() {
    return sql.prepare(this.query).get(...this.params) || null;
  }
  all() {
    return { results: sql.prepare(this.query).all(...this.params) };
  }
  run() {
    const r = sql.prepare(this.query).run(...this.params);
    return { meta: { changes: Number(r.changes) } };
  }
}
globalThis.__shopEnv = { DATABASE_PROVIDER: "d1",
  DB: {
    prepare: (query) => new Statement(query),
    batch(statements) {
      sql.exec("BEGIN");
      try {
        const r = statements.map((s) => s.run());
        sql.exec("COMMIT");
        return r;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  },
  PAGARME_SECRET_KEY: "sk_live_fake_for_offline_tests",
  PAGARME_ENVIRONMENT: "production",
};
globalThis.__shopUser = null;
const compiled = await build({
  stdin: {
    contents: `export * from './lib/shop/server'; export * from './lib/shop/checkout'; export * from './lib/shop/payments';`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  define: { "import.meta.env.DEV": "false" },
  plugins: [
    {
      name: "offline-fixtures",
      setup(b) {
        b.onResolve({ filter: /^@\/lib\/env$/ }, () => ({
          path: "env",
          namespace: "fixture",
        }));
        b.onResolve({ filter: /^@\/lib\/auth\/user$/ }, () => ({
          path: "auth",
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
          contents:
            a.path === "env"
              ? "export const env=globalThis.__shopEnv"
              : "export async function getStoreUser(){return globalThis.__shopUser}",
          loader: "js",
        }));
      },
    },
  ],
});
const shop = await import(
  "data:text/javascript;base64," +
    Buffer.from(compiled.outputFiles[0].text).toString("base64")
);
await shop.seed();
const settings = await shop.getSettings();
const ready = {
  ...settings,
  salesEnabled: true,
  inventoryConfirmed: true,
  email: "test@example.com",
  shippingPolicy: "Envio aprovado.",
  returnPolicy: "Trocas aprovadas.",
  privacyPolicy: "Privacidade aprovada.",
  terms: "Termos aprovados.",
  shippingRules: [
    {
      id: "delivery",
      label: "Entrega",
      states: [],
      amount: 10000,
      freeAbove: 0,
      minDays: 2,
      maxDays: 5,
      active: true,
    },
  ],
};
sql
  .prepare("UPDATE settings SET data=? WHERE key='store'")
  .run(JSON.stringify(ready));
sql.prepare("UPDATE products SET stock=1").run();
sql
  .prepare("INSERT INTO coupons VALUES ('OFFLINE','percent',10,0,1,0,1,NULL)")
  .run();
const request = new Request("https://shop.example/api/shop/checkout", {
  headers: { cookie: "sm_guest=" + "a".repeat(64) },
});
const data = {
  items: [
    {
      productId: "sm-200",
      quantity: 1,
      grade: { P: 50, M: 50, G: 50, GG: 50 },
    },
  ],
  customer: {
    type: "individual",
    name: "Cliente Teste",
    document: "52998224725",
    email: "test@example.com",
    phone: "11999999999",
    marketing: false,
  },
  address: {
    zip: "42803113",
    street: "Rua Dez de Abril",
    number: "s/n",
    complement: "",
    district: "Alto da Cruz",
    city: "Camaçari",
    state: "BA",
  },
  shippingId: "delivery",
  coupon: "OFFLINE",
  paymentMethod: "credit_card",
  requestKey: crypto.randomUUID(),
  termsAccepted: true,
  demo: false,
};
let payload,
  provider,
  linkStatus = "active",
  sessions = 0;
globalThis.fetch = async (url, options) => {
  const u = new URL(url);
  assert.equal(
    u.origin,
    globalThis.__shopEnv.PAGARME_ENVIRONMENT === "test"
      ? "https://sdx-api.pagar.me"
      : "https://api.pagar.me",
  );
  assert(options.headers.Authorization.startsWith("Basic "));
  if (u.pathname.endsWith("/paymentlinks") && options.method === "POST") {
    payload = JSON.parse(options.body);
    return Response.json({
      id: "pl_offline",
      url: "https://checkout.pagar.me/offline",
      status: "active",
    });
  }
  if (u.pathname.endsWith("/paymentlinks/pl_offline/cancel")) {
    linkStatus = "canceled";
    return Response.json({ status: "canceled" });
  }
  if (u.pathname.endsWith("/paymentlinks/pl_offline"))
    return Response.json({ status: linkStatus, total_sessions: sessions });
  if (u.pathname.endsWith("/orders"))
    return Response.json({ data: provider ? [provider] : [] });
  if (u.pathname.endsWith("/orders/or_offline")) return Response.json(provider);
  throw new Error("Unexpected provider endpoint " + u.pathname);
};
// Two simultaneous buyers compete for the last use of a coupon.
sql.prepare("UPDATE products SET stock=2 WHERE id='sm-400'").run();
sql.prepare("INSERT INTO coupons VALUES ('RACE','fixed',1000,0,1,0,1,NULL)").run();
const raceData={...data,coupon:'RACE',items:[{productId:'sm-400',quantity:1,grade:{P:100,M:100,G:100,GG:100}}]};
const race=await Promise.allSettled([shop.checkout(request,{...raceData,requestKey:crypto.randomUUID()}),shop.checkout(request,{...raceData,requestKey:crypto.randomUUID()})]);
assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
assert.equal(sql.prepare("SELECT stock FROM products WHERE id='sm-400'").get().stock,1);
assert.equal(sql.prepare("SELECT used FROM coupons WHERE code='RACE'").get().used,1);
const raceOrder=race.find(r=>r.status==='fulfilled').value.order;
const first = (await shop.checkout(request, data)).order;
assert.equal(first.total, 460000);
assert.equal(
  sql.prepare("SELECT stock FROM products WHERE id='sm-200'").get().stock,
  0,
);
assert.equal(
  sql.prepare("SELECT used FROM coupons WHERE code='OFFLINE'").get().used,
  1,
);
assert.equal(payload.cart_settings.items[0].amount, 460000);
assert.equal(payload.max_sessions, 1);
assert.equal(payload.max_paid_sessions, 1);
assert.equal(payload.expires_at, first.payment_config.expiresAt);
assert.equal(
  payload.payment_settings.credit_card_settings.installments[11].total,
  570400,
);
assert.equal((await shop.checkout(request, data)).order.id, first.id);
assert.equal(
  sql.prepare("SELECT stock FROM products WHERE id='sm-200'").get().stock,
  0,
);
await assert.rejects(
  () =>
    shop.checkout(request, {
      ...data,
      requestKey: crypto.randomUUID(),
      coupon: "",
    }),
  /Estoque/,
);
await assert.rejects(
  () =>
    shop.checkout(request, {
      ...data,
      requestKey: crypto.randomUUID(),
      items: [{ ...data.items[0], quantity: 2 }],
      coupon: "",
    }),
  /Estoque/,
);
sql
  .prepare("UPDATE settings SET data=? WHERE key='store'")
  .run(
    JSON.stringify({ ...ready, installmentInterest: 10, maxInstallments: 1 }),
  );
provider = {
  id: "or_offline",
  code: first.number,
  amount: 570400,
  currency: "BRL",
  status: "paid",
  charges: [{ status: "paid" }],
};
sessions = 1;
await shop.verifyProviderOrder("or_offline", "hook-paid");
assert.equal(
  sql.prepare("SELECT payment_status FROM orders WHERE id=?").get(first.id)
    .payment_status,
  "paid",
  "Original installments must survive settings changes.",
);
await shop.verifyProviderOrder("or_offline", "hook-paid");
assert.equal(
  sql
    .prepare("SELECT COUNT(*) AS n FROM order_events WHERE type='payment.paid'")
    .get().n,
  1,
);
provider.status = "failed";
provider.charges = [{ status: "failed" }];
await shop.verifyProviderOrder("or_offline");
assert.equal(
  sql.prepare("SELECT payment_status FROM orders WHERE id=?").get(first.id)
    .payment_status,
  "paid",
  "A late failure cannot regress an approved payment.",
);
sql.prepare("UPDATE orders SET fulfillment='shipped' WHERE id=?").run(first.id);
provider.status = "paid";
provider.charges = [{ status: "refunded" }];
await shop.verifyProviderOrder("or_offline");
assert.equal(
  sql.prepare("SELECT payment_status FROM orders WHERE id=?").get(first.id)
    .payment_status,
  "refunded",
);
assert.equal(
  sql.prepare("SELECT stock FROM products WHERE id='sm-200'").get().stock,
  0,
  "Shipped refunds cannot replenish stock automatically.",
);
// A separate, unpaid attempt can release exactly its own reservation, once.
sql.prepare("UPDATE products SET stock=1 WHERE id='sm-300'").run();
provider = null;
sessions = 0;
linkStatus = "active";
const second = (
  await shop.checkout(request, {
    ...data,
    requestKey: crypto.randomUUID(),
    coupon: "",
    paymentMethod: "pix",
    items: [
      {
        productId: "sm-300",
        quantity: 1,
        grade: { P: 75, M: 75, G: 75, GG: 75 },
      },
    ],
  })
).order;
await shop.cancelUnpaidOrder(second.id, "https://shop.example");
await shop.releaseReservation(second.id);
assert.equal(
  sql.prepare("SELECT stock FROM products WHERE id='sm-300'").get().stock,
  1,
);
assert.equal(
  sql.prepare("SELECT payment_status FROM orders WHERE id=?").get(second.id)
    .payment_status,
  "canceled",
);
provider = {
  id: "or_offline",
  code: second.number,
  amount: second.total,
  currency: "BRL",
  status: "paid",
  charges: [{ status: "paid" }],
};
await shop.verifyProviderOrder("or_offline");
assert.equal(
  sql.prepare("SELECT payment_status FROM orders WHERE id=?").get(second.id)
    .payment_status,
  "review",
  "Late payments after release require review.",
);
provider.amount = 1;
await shop.verifyProviderOrder("or_offline");
assert.equal(
  sql.prepare("SELECT payment_status FROM orders WHERE id=?").get(second.id)
    .payment_status,
  "review",
);
globalThis.__shopEnv.PAGARME_ENVIRONMENT = "test";
globalThis.__shopEnv.PAGARME_SECRET_KEY = "sk_test_offline";
sql
  .prepare("UPDATE settings SET data=? WHERE key='store'")
  .run(JSON.stringify({ ...settings, salesEnabled: false, demoEnabled: true }));
provider = null;
linkStatus = "active";
sessions = 0;
const sandbox = (
  await shop.checkout(request, {
    ...data,
    requestKey: crypto.randomUUID(),
    coupon: "",
    paymentMethod: "pix",
    shippingId: "demo-delivery",
  })
).order;
assert.equal(sandbox.sandbox, true);
assert.equal(sandbox.demo, 0);
assert.equal(
  sql.prepare("SELECT stock FROM products WHERE id='sm-200'").get().stock,
  0,
);
provider = {
  id: "or_offline",
  code: sandbox.number,
  amount: sandbox.total,
  currency: "BRL",
  status: "paid",
  charges: [{ status: "paid" }],
};
await shop.verifyProviderOrder("or_offline");
assert.equal(
  sql.prepare("SELECT payment_status FROM orders WHERE id=?").get(sandbox.id)
    .payment_status,
  "paid",
);
globalThis.__shopUser = {
  userId: "offline_account",
  email: "account@example.com",
};
await shop.claimGuestOrders(request);
assert.equal(
  sql.prepare("SELECT owner_key FROM orders WHERE id=?").get(sandbox.id)
    .owner_key,
  "user:offline_account",
);
globalThis.__shopUser = {
  userId: "foreign_account",
  email: "foreign@example.com",
};
await assert.rejects(
  () => shop.getOrder(sandbox.id, new Request("https://shop.example")),
  /Pedido não encontrado/,
);
// Expired and unused links release reservations through background maintenance.
globalThis.__shopEnv.PAGARME_ENVIRONMENT='production';globalThis.__shopEnv.PAGARME_SECRET_KEY='sk_live_fake_for_offline_tests';provider=null;sessions=0;linkStatus='expired';
sql.prepare("UPDATE orders SET payment_config=json_set(payment_config,'$.expiresAt',?) WHERE id=?").run('2020-01-01T00:00:00.000Z',raceOrder.id);
await shop.reconcileExpiredOrders();
assert.equal(sql.prepare('SELECT payment_status FROM orders WHERE id=?').get(raceOrder.id).payment_status,'canceled');
assert.equal(sql.prepare("SELECT stock FROM products WHERE id='sm-400'").get().stock,2);
assert.equal(sql.prepare("SELECT used FROM coupons WHERE code='RACE'").get().used,0);
console.log(
  "PASS: offline commerce checks; atomic reservation, idempotency, stock limits, coupon limit, immutable installments, authenticated confirmation, duplicate hooks, stale states, refund inventory and late payment review.",
);
sql.close();
