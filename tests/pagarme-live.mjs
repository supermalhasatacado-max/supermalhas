import assert from "node:assert/strict";
import { build } from "esbuild";
import { randomUUID } from "node:crypto";

// Read-only by default. --drafts creates inactive links and cancels each one;
// it never submits an order, card, Pix payment or boleto payment.
const secret = process.env.PAGARME_SECRET_KEY;
assert(secret?.startsWith("sk_"), "Configure PAGARME_SECRET_KEY somente no ambiente privado.");
const environment = process.env.PAGARME_ENVIRONMENT || (secret.startsWith("sk_test") ? "test" : "production");
assert(["test", "production"].includes(environment), "Ambiente Pagar.me inválido.");
assert.equal(secret.startsWith("sk_test"), environment === "test", "A chave e o ambiente Pagar.me divergem.");
const base = environment === "test" ? "https://sdx-api.pagar.me/core/v5" : "https://api.pagar.me/core/v5";
const headers = {
  Authorization: `Basic ${Buffer.from(secret + ":").toString("base64")}`,
  "Content-Type": "application/json",
  "User-Agent": "SuperMalhasAtacado/1.0",
};
async function api(path, options = {}) {
  const response = await fetch(base + path, {
    ...options, headers: { ...headers, ...options.headers }, signal: AbortSignal.timeout(25000),
  });
  // Do not print provider bodies: they can contain customer data or credentials.
  assert(response.ok, `Pagar.me ${options.method || "GET"} ${path.split("?")[0]}: HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}
await api("/orders?size=1");
console.log(`PASS: autenticação Pagar.me em ${environment}.`);
if (process.argv.includes("--drafts")) {
  const compiled = await build({
    stdin: { contents: "export * from './lib/shop/payments'; export * from './lib/shop/defaults';", resolveDir: process.cwd() },
    bundle: true, write: false, platform: "node", format: "esm",
    plugins: [{ name: "server-context", setup(b) {
      b.onResolve({ filter: /^@\/lib\/env$/ }, () => ({ path: "env", namespace: "fixture" }));
      b.onResolve({ filter: /^@\/lib\/auth\/user$/ }, () => ({ path: "auth", namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, a => ({
        contents: a.path === "env" ? "export const env=process.env" : "export async function getStoreUser(){return null}", loader: "js",
      }));
    } }],
  });
  const shop = await import("data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].text).toString("base64"));
  const origin = "https://supermalhasatacado.com.br";
  for (const method of ["pix", "boleto", "credit_card"]) {
    const run = randomUUID();
    const order = {
      id: run, number: `SM-QA-${run.slice(0, 8)}`, total: 500000, payment_method: method,
      created_at: new Date().toISOString(), items: [{ quantity: 1, title: "Homologação inativa", pieces: 200 }],
      customer: { name: "Homologacao Super Malhas", email: "homologacao@example.com", type: "individual", document: "12345678909", phone: "11999999999" },
      address: { state: "SP", city: "Sao Paulo", zip: "01310100", number: "1000", street: "Avenida Paulista", district: "Bela Vista", complement: "" },
    };
    const payload = { ...shop.paymentLinkPayload(order, shop.defaultSettings, origin), name: `HOMOLOGACAO INATIVA - ${method}`, is_building: true };
    const created = new Set();
    try {
      const options = { method: "POST", headers: { "Idempotency-Key": `sm-qa-${run}` }, body: JSON.stringify(payload) };
      const first = await api("/paymentlinks", options);
      if (first.id) created.add(first.id);
      assert.match(first.id, /^pl_[A-Za-z0-9]+$/);
      assert.equal(first.status, "building", "O link de teste deve permanecer inativo.");
      const saved = await api(`/paymentlinks/${first.id}`);
      assert.equal(saved.status, "building");
      assert.equal(saved.cart_settings.total_cost, order.total);
      assert.deepEqual(saved.payment_settings.accepted_payment_methods, [method]);
      assert.equal(saved.order_code, order.number);
      assert.equal(saved.max_sessions, 1);
      assert.equal(saved.max_paid_sessions, 1);
      if (method === "credit_card") assert.deepEqual(saved.payment_settings.credit_card_settings.installments, payload.payment_settings.credit_card_settings.installments);
      const repeated = await api("/paymentlinks", options);
      if (repeated.id) created.add(repeated.id);
      console.log(`PASS: ${method}: payload, total, método, código e limites conferidos. Provedor deduplica POST: ${repeated.id === first.id}; a loja aplica trava durável própria.`);
    } finally {
      for (const id of created) {
        await api(`/paymentlinks/${id}/cancel`, { method: "PATCH" });
        const canceled = await api(`/paymentlinks/${id}`);
        assert.notEqual(canceled.status, "active");
        assert.notEqual(canceled.status, "building");
        assert.equal(canceled.total_sessions, 0, "O teste não pode gerar cobrança.");
      }
      if (created.size) console.log(`PASS: ${method}: links de teste cancelados, sem sessão de pagamento.`);
    }
  }
}
