import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { PGlite } from "@electric-sql/pglite";
import { build } from "esbuild";

// Real PostgreSQL (WASM), actual migrations and application code. All external
// requests are intercepted: no cloud data, payment or credentials are involved.
const pg = new PGlite();
await pg.exec(
  "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);",
);
for (const file of readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort())
  await pg.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
assert.equal(
  (
    await pg.query(
      "SELECT public FROM storage.buckets WHERE id='supermalhas-products'",
    )
  ).rows[0].public,
  false,
);
assert.equal(
  (
    await pg.query(
      "SELECT count(*)::integer AS n FROM pg_tables WHERE schemaname='supermalhas' AND rowsecurity",
    )
  ).rows[0].n,
  9,
);
await pg.exec("SET ROLE anon");
await assert.rejects(
  () => pg.query("SELECT public.sm_database_v1('[]'::jsonb)"),
  /permission denied/,
);
await assert.rejects(
  () => pg.query("SELECT * FROM supermalhas.orders"),
  /permission denied/,
);
await assert.rejects(
  () => pg.query("SELECT public.sm_import_d1_v1('{}'::jsonb)"),
  /permission denied/,
);
await pg.exec("RESET ROLE; SET ROLE authenticated");
await assert.rejects(
  () => pg.query("SELECT public.sm_database_v1('[]'::jsonb)"),
  /permission denied/,
);
await pg.exec(
  "RESET ROLE; SET ROLE service_role; SET search_path=supermalhas,pg_catalog",
);

globalThis.__shopEnv = {
  DATABASE_PROVIDER: "supabase",
  SUPABASE_URL: "https://offline-test.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_offline_fixture",
  PAGARME_SECRET_KEY: "sk_live_fake_for_offline_tests",
  PAGARME_ENVIRONMENT: "production",
};
globalThis.__shopUser = null;
const compiled = await build({
  stdin: {
    contents:
      "export * from './lib/shop/server'; export * from './lib/shop/checkout'; export * from './lib/shop/payments'; export * from './lib/shop/defaults'; export * from './db/supabase'; export * from './lib/shop/storage';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  define: { "import.meta.env.DEV": "false" },
  plugins: [
    {
      name: "fixtures",
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
globalThis.__shopEnv.PAGARME_ENVIRONMENT = "test";
assert.throws(() => shop.paymentEnvironment(), /precisam corresponder/);
globalThis.__shopEnv.PAGARME_ENVIRONMENT = "production";
// Admin access requires a verified identity and an explicit email allowlist.
globalThis.__shopEnv.ADMIN_EMAILS = " owner@example.com , SECOND@example.com ";
assert.equal(await shop.isAdmin(), false);
globalThis.__shopUser = { userId: "test-owner", email: "owner@example.com", emailVerified: false };
assert.equal(await shop.isAdmin(), false);
globalThis.__shopUser.emailVerified = true;
assert.equal(await shop.isAdmin(), true);
globalThis.__shopUser.email = "second@example.com";
assert.equal(await shop.isAdmin(), true);
globalThis.__shopUser.email = "customer@example.com";
assert.equal(await shop.isAdmin(), false);
globalThis.__shopUser = null;
delete globalThis.__shopEnv.ADMIN_EMAILS;
let provider, payload;
let linkPosts = 0, linkMode = "ok";
const providerLinks = new Map();
const photos = new Map(),
  executed = new Set();
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(input),
    headers = new Headers(options.headers);
  if (url.origin === "https://offline-test.supabase.co") {
    assert.equal(headers.get("apikey"), "sb_secret_offline_fixture");
    assert.equal(
      headers.get("Authorization"),
      null,
      "Secret API keys are not JWTs",
    );
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const body = JSON.parse(options.body);
      if (body.operations)
        for (const op of body.operations) executed.add(op.id);
      const name = url.pathname.endsWith("sm_import_d1_v1")
        ? "sm_import_d1_v1"
        : "sm_database_v1";
      try {
        return Response.json(
          (
            await pg.query(`SELECT public.${name}($1::jsonb) AS result`, [
              JSON.stringify(body.operations || body.snapshot),
            ])
          ).rows[0].result,
        );
      } catch {
        return Response.json(
          { error: "Database operation failed" },
          { status: 400 },
        );
      }
    }
    if (url.pathname.startsWith("/storage/v1/object/")) {
      if (options.method === "POST") {
        photos.set(url.pathname, {
          bytes: options.body,
          type: headers.get("content-type"),
        });
        return Response.json({ ok: true });
      }
      const photo = photos.get(url.pathname);
      return photo
        ? new Response(photo.bytes, { headers: { "Content-Type": photo.type } })
        : new Response(null, { status: 404 });
    }
  }
  if (
    url.origin === "https://api.pagar.me" ||
    url.origin === "https://sdx-api.pagar.me"
  ) {
    assert(headers.get("Authorization").startsWith("Basic "));
    if (url.pathname.endsWith("/paymentlinks") && options.method === "POST") {
      linkPosts++;
      payload = JSON.parse(options.body);
      if (linkMode === "reject") return Response.json({}, { status: 422 });
      const link = {
        ...payload,
        id: "pl_offline",
        url: "https://checkout.pagar.me/offline",
        status: "active",
        cart_settings: { ...payload.cart_settings, total_cost: payload.cart_settings.items[0].amount },
      };
      providerLinks.set(payload.name, link);
      if (linkMode === "timeout") throw new Error("Response lost after provider creation");
      return Response.json(link);
    }
    if (url.pathname.endsWith("/paymentlinks") && (!options.method || options.method === "GET"))
      return Response.json({ content: [...providerLinks.values()].filter(link => link.name === url.searchParams.get("name")).map(({ id, name, status }) => ({ id, name, status })) });
    if (url.pathname.endsWith("/orders/or_offline"))
      return Response.json(provider);
    if (url.pathname.endsWith("/orders"))
      return Response.json({ data: provider ? [provider] : [] });
    if (url.pathname.endsWith("/paymentlinks/pl_offline"))
      return Response.json(linkMode === "recovery" ? providerLinks.get(payload.name) : { status: "inactive", total_sessions: 0 });
  }
  throw new Error(`Unexpected external request: ${url.origin}${url.pathname}`);
};
const row = async (sql, params = []) => (await pg.query(sql, params)).rows[0];
try {
  await shop.seed();
  await shop.seed();
  assert.equal((await shop.getProducts()).length, 3);
  const ready = {
    ...(await shop.getSettings()),
    demoEnabled: true,
    salesEnabled: true,
    inventoryConfirmed: true,
    email: "test@example.com",
    shippingPolicy: "Envio.",
    returnPolicy: "Trocas.",
    privacyPolicy: "Privacidade.",
    terms: "Termos.",
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
  await shop
    .db()
    .prepare("UPDATE settings SET data=? WHERE key='store'")
    .bind(JSON.stringify(ready))
    .run();
  await pg.exec(
    "UPDATE products SET stock=2; INSERT INTO coupons VALUES('OFFLINE','percent',10,0,1,0,1,NULL)",
  );
  const request = new Request("https://shop.example/api/shop/checkout", {
    headers: { cookie: "sm_guest=" + "a".repeat(64) },
  });
  const arrangedDelivery = shop.shippingQuotes({ ...ready, shippingRules: [{ ...ready.shippingRules[0], toArrange: true, amount: 9999 }] }, "AM", 500000);
  assert.equal(arrangedDelivery[0].toArrange, true);
  assert.equal(arrangedDelivery[0].amount, 0, "Frete a combinar is separate from the charged products total");
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
  const competingData = { ...data, requestKey: crypto.randomUUID() };
  const buyers = await Promise.allSettled([
    shop.checkout(request, data),
    shop.checkout(request, competingData),
  ]);
  assert.equal(
    buyers.filter((x) => x.status === "fulfilled").length,
    1,
    "Only one buyer can use the last coupon",
  );
  const first = buyers.find((x) => x.status === "fulfilled").value.order;
  assert.equal(first.total, 460000);
  assert.equal(first.items[0].grade.GG, 50);
  assert.equal(
    (await row("SELECT stock FROM products WHERE id='sm-200'")).stock,
    1,
  );
  assert.equal(
    (await row("SELECT used FROM coupons WHERE code='OFFLINE'")).used,
    1,
  );
  assert.equal(payload.cart_settings.items[0].amount, 460000);
  const winnerData = buyers[0].status === "fulfilled" ? data : competingData;
  assert.equal(
    (await shop.checkout(request, winnerData)).order.id,
    first.id,
    "Retries preserve the original order",
  );
  const lastStock = await Promise.allSettled([
    shop.checkout(request, {
      ...data,
      coupon: "",
      requestKey: crypto.randomUUID(),
    }),
    shop.checkout(request, {
      ...data,
      coupon: "",
      requestKey: crypto.randomUUID(),
    }),
  ]);
  assert.equal(
    lastStock.filter((x) => x.status === "fulfilled").length,
    1,
    "Stock cannot become negative",
  );
  assert.equal(
    (await row("SELECT stock FROM products WHERE id='sm-200'")).stock,
    0,
  );
  // Every write in a batch rolls back if a later write violates a constraint.
  await assert.rejects(() =>
    shop.db().batch([
      shop
        .db()
        .prepare("UPDATE settings SET data=? WHERE key='store'")
        .bind(JSON.stringify({ ...ready, storeName: "Should roll back" })),
      shop
        .db()
        .prepare(
          "UPDATE products SET stock=stock-?,updated_at=? WHERE id=? AND EXISTS (SELECT 1 FROM orders WHERE id=?)",
        )
        .bind(999, shop.now(), "sm-200", first.id),
    ]),
  );
  assert.equal((await shop.getSettings()).storeName, ready.storeName);
  provider = {
    id: "or_offline",
    code: first.number,
    amount: 570400,
    currency: "BRL",
    status: "paid",
    charges: [{ status: "paid" }],
  };
  await shop.verifyProviderOrder("or_offline", "hook-paid");
  await shop.verifyProviderOrder("or_offline", "hook-paid");
  assert.equal(
    (await row("SELECT payment_status FROM orders WHERE id=$1", [first.id]))
      .payment_status,
    "paid",
  );
  assert.equal(
    (
      await row(
        "SELECT count(*)::integer AS n FROM order_events WHERE type='payment.paid'",
      )
    ).n,
    1,
  );
  provider.status = "failed";
  provider.charges = [{ status: "failed" }];
  await shop.verifyProviderOrder("or_offline");
  assert.equal(
    (await row("SELECT payment_status FROM orders WHERE id=$1", [first.id]))
      .payment_status,
    "paid",
  );
  await pg.query("UPDATE orders SET fulfillment='shipped' WHERE id=$1", [
    first.id,
  ]);
  provider.charges = [{ status: "refunded" }];
  await shop.verifyProviderOrder("or_offline");
  assert.equal(
    (await row("SELECT stock FROM products WHERE id='sm-200'")).stock,
    0,
    "Shipped refunds do not restock",
  );
  const last = lastStock.find((x) => x.status === "fulfilled").value.order;
  await pg.query("UPDATE orders SET payment_status='failed' WHERE id=$1", [
    last.id,
  ]);
  await Promise.all([
    shop.releaseReservation(last.id),
    shop.releaseReservation(last.id),
  ]);
  assert.equal(
    (await row("SELECT stock FROM products WHERE id='sm-200'")).stock,
    1,
    "Repeated release is idempotent",
  );
  const injected = "O'Brien'); DELETE FROM supermalhas.orders; --";
  await shop.event(first.id, "test.bound", injected);
  assert.equal(
    (await row("SELECT note FROM order_events WHERE type='test.bound'")).note,
    injected,
  );
  assert.equal(
    (await row("SELECT count(*)::integer AS n FROM orders")).n,
    2,
    "Bound data cannot execute SQL",
  );
  await assert.rejects(
    () => shop.db().prepare("DELETE FROM orders").run(),
    /não cadastrada/,
  );
  await assert.rejects(
    () =>
      pg.query("SELECT public.sm_database_v1($1::jsonb)", [
        JSON.stringify([{ id: "unknown", params: [] }]),
      ]),
    /Unknown/,
  );
  await shop.rateLimit(
    new Request("https://shop.example", {
      headers: { "cf-connecting-ip": "127.0.0.2" },
    }),
    "fixture",
    1,
  );
  await assert.rejects(
    () =>
      shop.rateLimit(
        new Request("https://shop.example", {
          headers: { "cf-connecting-ip": "127.0.0.2" },
        }),
        "fixture",
        1,
      ),
    /Muitas tentativas/,
  );
  globalThis.__shopUser = {
    userId: "account-test",
    email: "client@example.com",
  };
  await shop.claimGuestOrders(request);
  assert.equal(
    (await row("SELECT owner_key FROM orders WHERE id=$1", [first.id]))
      .owner_key,
    "user:account-test",
  );
  assert.equal((await shop.getOrder(first.id, request)).id, first.id);
  globalThis.__shopUser = null;
  await assert.rejects(
    () => shop.getOrder(first.id, request),
    /não encontrado/,
  );
  await shop.putProductImage(
    "photo-test",
    new Uint8Array([1, 2, 3]),
    "image/png",
  );
  const photo = await shop.getProductImage("photo-test");
  assert.equal(photo.headers.get("content-type"), "image/png");
  assert.deepEqual(
    new Uint8Array(await photo.arrayBuffer()),
    new Uint8Array([1, 2, 3]),
  );
  assert.equal(await shop.getProductImage("missing"), null);
  // Exercise the administrative and account write/read paths against Postgres.
  const database = shop.db(),
    stamp = shop.now();
  await database
    .prepare(
      "INSERT INTO profiles (user_id,data,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",
    )
    .bind(
      "profile-test",
      JSON.stringify({ customer: data.customer, address: data.address }),
      stamp,
    )
    .run();
  const profile = await database
    .prepare("SELECT data FROM profiles WHERE user_id=?")
    .bind("profile-test")
    .first();
  assert.equal(JSON.parse(profile.data).customer.name, "Cliente Teste");
  await database
    .prepare(
      "INSERT INTO contacts (id,name,email,message,status,created_at) VALUES (?,?,?,?,?,?)",
    )
    .bind(
      "contact-test",
      "Cliente Teste",
      "test@example.com",
      "Mensagem de atendimento.",
      "new",
      stamp,
    )
    .run();
  await database
    .prepare("UPDATE contacts SET status=? WHERE id=?")
    .bind("resolved", "contact-test")
    .run();
  assert.equal(
    (
      await database
        .prepare("SELECT * FROM contacts ORDER BY created_at DESC LIMIT 200")
        .all()
    ).results[0].status,
    "resolved",
  );
  await database
    .prepare(
      "INSERT INTO newsletter (email,active,created_at) VALUES (?,1,?) ON CONFLICT(email) DO UPDATE SET active=1",
    )
    .bind("test@example.com", stamp)
    .run();
  assert.equal(
    (
      await database
        .prepare(
          "SELECT email,created_at,active FROM newsletter ORDER BY created_at DESC LIMIT 500",
        )
        .all()
    ).results[0].active,
    1,
  );
  const p = shop.defaultProducts[1];
  await database
    .prepare(
      "INSERT INTO products (id,slug,title,pieces,price,stock,active,featured,description,image,specs,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,pieces=excluded.pieces,price=excluded.price,stock=excluded.stock,active=excluded.active,featured=excluded.featured,description=excluded.description,image=excluded.image,specs=excluded.specs,updated_at=excluded.updated_at",
    )
    .bind(
      p.id,
      p.slug,
      p.title,
      p.pieces,
      p.price,
      4,
      p.active,
      p.featured,
      p.description,
      p.image,
      JSON.stringify(p.specs),
      stamp,
    )
    .run();
  assert.equal(
    (await shop.getProducts(true)).find((x) => x.id === p.id).stock,
    4,
  );
  await database
    .prepare(
      "INSERT INTO coupons (code,kind,value,minimum,usage_limit,used,active,expires_at) VALUES (?,?,?,?,?,0,?,?) ON CONFLICT(code) DO UPDATE SET kind=excluded.kind,value=excluded.value,minimum=excluded.minimum,usage_limit=excluded.usage_limit,active=excluded.active,expires_at=excluded.expires_at",
    )
    .bind("RELEASE", "fixed", 1000, 0, 2, 1, null)
    .run();
  assert.equal(
    (await database.prepare("SELECT * FROM coupons ORDER BY code").all())
      .results.length,
    2,
  );
  const releaseOrder = (
    await shop.checkout(request, {
      ...data,
      items: [
        {
          productId: "sm-300",
          quantity: 1,
          grade: { P: 75, M: 75, G: 75, GG: 75 },
        },
      ],
      coupon: "RELEASE",
      requestKey: crypto.randomUUID(),
    })
  ).order;
  await shop.cancelUnpaidOrder(releaseOrder.id, "https://shop.example");
  assert.equal(
    (await row("SELECT used FROM coupons WHERE code='RELEASE'")).used,
    0,
  );
  assert.equal(
    (await row("SELECT stock FROM products WHERE id='sm-300'")).stock,
    4,
  );
  await shop.reconcileExpiredOrders();
  await database
    .prepare("DELETE FROM rate_limits WHERE expires_at<?")
    .bind(0)
    .run();
  assert(
    (
      await database
        .prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 500")
        .all()
    ).results.length >= 3,
  );
  assert.equal(
    (
      await database
        .prepare(
          "SELECT * FROM orders WHERE owner_key=? ORDER BY created_at DESC LIMIT 100",
        )
        .bind("user:account-test")
        .all()
    ).results.length,
    2,
  );
  // The real /paymentlinks endpoint can ignore Idempotency-Key. Prove the
  // application sends one POST, including after a lost provider response.
  await pg.exec("UPDATE products SET stock=20 WHERE id='sm-200'");
  linkMode = "timeout";
  const postsBeforeTimeout = linkPosts;
  const uncertain = (await shop.checkout(request, { ...data, coupon: "", requestKey: crypto.randomUUID() })).order;
  assert.equal(linkPosts, postsBeforeTimeout + 1);
  assert(!uncertain.payment_link);
  linkMode = "recovery";
  const uncertainLink = providerLinks.get(payload.name);
  providerLinks.delete(payload.name);
  await assert.rejects(() => shop.createPaymentLink(uncertain, "https://shop.example"), /sendo conferido/);
  assert.equal(linkPosts, postsBeforeTimeout + 1, "An inconclusive lookup must not send another POST");
  providerLinks.set(payload.name, uncertainLink);
  const recovered = await Promise.all([
    shop.createPaymentLink(uncertain, "https://shop.example"),
    shop.createPaymentLink(uncertain, "https://shop.example"),
  ]);
  assert.equal(new Set(recovered).size, 1);
  assert.equal(linkPosts, postsBeforeTimeout + 1, "Timeout recovery must not create a second provider link");
  linkMode = "reject";
  const rejected = (await shop.checkout(request, { ...data, coupon: "", requestKey: crypto.randomUUID() })).order;
  const postsAfterRejection = linkPosts;
  linkMode = "ok";
  await shop.createPaymentLink(rejected, "https://shop.example");
  assert.equal(linkPosts, postsAfterRejection + 1, "A definite rejection allows one new attempt");
  await shop.createPaymentLink(rejected, "https://shop.example");
  assert.equal(linkPosts, postsAfterRejection + 1, "A stale caller reuses the persisted link");
  const freshId = crypto.randomUUID();
  await pg.query("INSERT INTO orders SELECT (jsonb_populate_record(NULL::orders, to_jsonb(o) || $1::jsonb)).* FROM orders o WHERE id=$2", [JSON.stringify({ id: freshId, number: `SM-QA-${freshId}`, request_key: crypto.randomUUID(), payment_link: null, provider_link_id: null, provider_order_id: null, payment_status: "creating" }), rejected.id]);
  const freshOrder = shop.decodeOrder(await shop.db().prepare("SELECT * FROM orders WHERE id=?").bind(freshId).first());
  const postsBeforeConcurrent = linkPosts;
  linkMode = "recovery";
  const concurrentLinks = await Promise.allSettled([
    shop.createPaymentLink(freshOrder, "https://shop.example"),
    shop.createPaymentLink(freshOrder, "https://shop.example"),
  ]);
  assert(concurrentLinks.some(r => r.status === "fulfilled"));
  assert.equal(linkPosts, postsBeforeConcurrent + 1, "Concurrent callers across durable DB claims create one provider link");
  for (const r of concurrentLinks) if (r.status === "rejected") assert.equal(r.reason.status, 409);
  linkMode = "ok";
  console.log("PASS: durable payment-link claim, timeout recovery, inconclusive lookup, definite rejection retry and freight paid separately.");
  const demoSettings = { ...ready, salesEnabled: false };
  await database
    .prepare("UPDATE settings SET data=? WHERE key='store'")
    .bind(JSON.stringify(demoSettings))
    .run();
  const demo = (
    await shop.checkout(request, {
      ...data,
      coupon: "",
      demo: true,
      shippingId: "delivery",
      requestKey: crypto.randomUUID(),
    })
  ).order;
  await database
    .prepare(
      "UPDATE orders SET payment_status=?,updated_at=? WHERE id=? AND demo=1",
    )
    .bind("paid", stamp, demo.id)
    .run();
  await database
    .prepare(
      "UPDATE orders SET fulfillment=?,tracking_code=?,carrier=?,invoice_url=?,updated_at=? WHERE id=?",
    )
    .bind("shipped", "TRACK", "Transportadora", "", stamp, demo.id)
    .run();
  await shop.cancelUnpaidOrder(demo.id, "https://shop.example");
  globalThis.__shopEnv.SUPABASE_URL = "https://untrusted.example";
  await assert.rejects(() => shop.getSettings(), /oficial/);
  globalThis.__shopEnv.SUPABASE_URL = "https://offline-test.supabase.co";
  // Import a legacy D1 snapshot, including customized settings and stock.
  await assert.rejects(
    () => pg.exec("TRUNCATE order_events"),
    /permission denied/,
  );
  await pg.exec(
    "RESET ROLE; TRUNCATE supermalhas.order_events,supermalhas.orders,supermalhas.products,supermalhas.coupons,supermalhas.profiles,supermalhas.contacts,supermalhas.newsletter,supermalhas.rate_limits,supermalhas.settings; SET ROLE service_role; SET search_path=supermalhas,pg_catalog",
  );
  const legacy = new DatabaseSync(":memory:");
  for (const file of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    legacy.exec(readFileSync(`drizzle/${file}`, "utf8"));
  legacy
    .prepare("INSERT INTO settings VALUES('store',?)")
    .run(JSON.stringify({ ...ready, storeName: "Legacy store" }));
  for (const p of shop.defaultProducts)
    legacy
      .prepare("INSERT INTO products VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(
        p.id,
        p.slug,
        p.title,
        p.pieces,
        p.price,
        7,
        p.active,
        p.featured,
        p.description,
        p.image,
        JSON.stringify(p.specs),
        shop.now(),
      );
  globalThis.__shopEnv.DB = {
    prepare(query) {
      return {
        first: async () => legacy.prepare(query).get() || null,
        all: async () => ({ results: legacy.prepare(query).all() }),
      };
    },
    batch: async (statements) => Promise.all(statements.map((s) => s.all())),
  };
  globalThis.__shopEnv.SUPABASE_MIGRATE_D1 = "true";
  await shop.seed();
  await shop.seed();
  assert.equal((await shop.getSettings()).storeName, "Legacy store");
  assert.equal((await shop.getProducts())[0].stock, 7);
  assert.equal(
    legacy.prepare("SELECT stock FROM products LIMIT 1").get().stock,
    7,
    "The source database is preserved",
  );
  assert.equal(
    (await row("SELECT data FROM settings WHERE key='migration:d1'")).data
      .counts.products,
    3,
  );
  legacy.close();
  console.log(
    `PASS: Supabase/PostgreSQL; migrations, 9 RLS tables, restricted RPC, private Storage, real application checkout, concurrent buyers, stock/coupon limits, transaction rollback, idempotency, payment transitions, ownership, rate limits, parameter injection and D1 import (${executed.size} operations exercised).`,
  );
} finally {
  await pg.close();
}
