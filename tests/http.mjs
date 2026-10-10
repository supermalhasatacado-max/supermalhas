import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.TEST_URL || "http://127.0.0.1:5186";
assert(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "These tests only mutate the local development database.",
);
const admin = "__sites_local_auth=1";
let guest = "";
let checks = 0;
async function call(path, body, cookie = guest, expected = 200, extra = {}) {
  const r = await fetch(`${base}/api/shop/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined
        ? {}
        : { "Content-Type": "application/json", Origin: base }),
      Cookie: cookie,
      ...extra,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await r.text();
  assert.equal(r.status, expected, `${path}: ${text}`);
  checks++;
  return {
    data: r.headers.get("content-type")?.includes("application/json")
      ? JSON.parse(text)
      : { error: text },
    cookie: r.headers.get("set-cookie"),
  };
}
const initial = await call("bootstrap");
guest = initial.cookie.split(";")[0];
assert.equal(initial.data.settings.legalName, "ANABELA AG MODAS LTDA");
assert.equal(initial.data.settings.cnpj, "58.312.831/0001-89");
assert.equal(initial.data.settings.fiscalEmail, "");
assert.equal(initial.data.admin, false);
await call("admin/dashboard", undefined, guest, 403);
await call("admin/dashboard", undefined, guest, 403, {
  "oai-authenticated-user-id": "local_seedy",
  "oai-authenticated-user-email": "seedy@sites.test",
});
const dashboard = (await call("admin/dashboard", undefined, admin)).data;
const settings = dashboard.settings,
  p = dashboard.products[0],
  { updated_at, ...product } = p;
const coupon = "QA_" + randomUUID().slice(0, 8).toUpperCase();
const items = [
  { productId: p.id, quantity: 1, grade: { P: 50, M: 50, G: 50, GG: 50 } },
];
try {
  const changed = {
    ...settings,
    email: "teste@example.com",
    shippingRules: [
      {
        id: "qa-entrega",
        label: "Entrega de teste local",
        states: ["BA"],
        amount: 15000,
        freeAbove: 0,
        minDays: 2,
        maxDays: 5,
        active: true,
      },
    ],
  };
  await call("admin/settings", changed, admin);
  assert.equal(
    (await call("bootstrap")).data.settings.email,
    "teste@example.com",
  );
  await call("admin/settings", { ...changed, salesEnabled: true }, admin, 400);
  await call("admin/products", { ...product, stock: 8 }, admin);
  assert.equal((await call("bootstrap")).data.products[0].stock, 8);
  await call(
    "admin/coupons",
    {
      code: coupon,
      kind: "percent",
      value: 5,
      minimum: 0,
      usage_limit: 1,
      active: 1,
      expires_at: "2030-01-01T23:59:59-03:00",
    },
    admin,
  );
  const quote = (await call("quote", { items, state: "BA", coupon })).data;
  assert.equal(quote.subtotal, 500000);
  assert.equal(quote.discount, 25000);
  assert.equal(quote.shipping[0].amount, 15000);
  await call(
    "quote",
    { items: [{ ...items[0], price: 1 }], state: "BA" },
    guest,
    400,
  );
  await call(
    "quote",
    { items: [{ ...items[0], grade: { P: 1, M: 1, G: 1, GG: 1 } }] },
    guest,
    400,
  );
  await call("quote", { items, state: "XX" }, guest, 400);
  await call("quote", { items }, guest, 403, {
    Origin: "https://different.example",
  });
  const checkout = {
    items,
    customer: {
      type: "individual",
      name: "Cliente Teste Local",
      document: "52998224725",
      email: "teste@example.com",
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
    shippingId: "qa-entrega",
    coupon,
    paymentMethod: "pix",
    requestKey: randomUUID(),
    termsAccepted: true,
    demo: true,
  };
  const order = (await call("checkout", checkout)).data;
  assert.equal(order.total, 490000);
  assert.equal(order.demo, 1);
  assert.equal(order.payment_status, "pending");
  assert.equal(order.payment_link, null);
  assert.equal((await call("checkout", checkout)).data.id, order.id);
  assert.equal(
    (await call("bootstrap")).data.products[0].stock,
    8,
    "Demo must not reserve stock.",
  );
  await call(
    `orders/${order.id}`,
    undefined,
    "sm_guest=" + "b".repeat(64),
    404,
  );
  await call(
    "checkout",
    { ...checkout, requestKey: randomUUID(), demo: false },
    guest,
    409,
  );
  await call(
    "checkout",
    { ...checkout, requestKey: randomUUID(), termsAccepted: false },
    guest,
    400,
  );
  await call(
    `admin/orders/${order.id}/demo-payment`,
    { status: "paid" },
    admin,
  );
  await call(
    `admin/orders/${order.id}`,
    { fulfillment: "shipped", tracking_code: "", carrier: "", invoice_url: "" },
    admin,
    400,
  );
  await call(
    `admin/orders/${order.id}`,
    {
      fulfillment: "shipped",
      tracking_code: "QA123",
      carrier: "Transportadora de teste",
      invoice_url: "",
    },
    admin,
  );
  const fetched = (await call(`orders/${order.id}`)).data;
  assert.equal(fetched.tracking_code, "QA123");
  assert.equal(fetched.fulfillment, "shipped");
  assert(fetched.events.length >= 3);
  await call("contact", {
    name: "Teste de Atendimento",
    email: "teste@example.com",
    message: "Teste local da central de atendimento.",
    website: "",
  });
  await call("newsletter", { email: "teste@example.com", consent: true });
  const d = (await call("admin/dashboard", undefined, admin)).data;
  assert(d.contacts.some((c) => c.message.includes("Teste local")));
  assert(d.subscribers.some((c) => c.email === "teste@example.com"));
  console.log(
    `PASS: ${checks} HTTP checks; checkout, ownership, prices, grades, coupons, shipping, admin, contact, consent and CSRF.`,
  );
} finally {
  await call("admin/settings", settings, admin);
  await call("admin/products", product, admin);
  await call(
    "admin/coupons",
    {
      code: coupon,
      kind: "percent",
      value: 5,
      minimum: 0,
      usage_limit: 1,
      active: 0,
      expires_at: null,
    },
    admin,
  );
}
