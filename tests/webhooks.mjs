import assert from "node:assert/strict";
import { build } from "esbuild";
globalThis.__hookEnv = {};
globalThis.__hookVerified = [];
globalThis.__hookFailure = false;
const compiled = await build({
  stdin: { contents: "export * from './app/api/webhooks/pagarme/route';", resolveDir: process.cwd() },
  bundle: true, write: false, platform: "node", format: "esm",
  plugins: [{ name: "webhook-fixture", setup(b) {
    b.onResolve({ filter: /^@\/lib\/(env|shop\/server|shop\/payments)$/ }, a => ({ path: a.path, namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, a => ({ loader: "js", contents:
      a.path.endsWith("/env") ? "export const env=globalThis.__hookEnv" :
      a.path.endsWith("/server") ? "export class ShopError extends Error { constructor(message,status=400){super(message);this.status=status} }; export const db=()=>({});export async function seed(){};export async function rateLimit(){}" :
      "import {ShopError} from '@/lib/shop/server';export async function verifyProviderOrder(id,hook){if(!/^or_[A-Za-z0-9]+$/.test(id))throw new ShopError('Referência inválida.');if(globalThis.__hookFailure)throw new ShopError('Provedor indisponível.',502);globalThis.__hookVerified.push({id,hook});}"
    }));
  } }],
});
const { POST } = await import("data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].text).toString("base64"));
const send = (body, headers = {}) => POST(new Request("https://shop.example/api/webhooks/pagarme", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) }));
const valid = { id: "hook_1", type: "order.paid", data: { id: "or_verified", amount: 1, status: "paid" } };
assert.equal((await send(valid)).status, 503);
globalThis.__hookEnv.PAGARME_SECRET_KEY = "sk_offline_fixture";
for (const invalid of ["{", "null", {}, { ...valid, id: "" }, { ...valid, data: {} }])
  assert.equal((await send(invalid)).status, 400);
assert.equal((await send("x".repeat(256001))).status, 413);
globalThis.__hookEnv.PAGARME_WEBHOOK_SECRET = "offline-fixture";
assert.equal((await send(valid)).status, 401);
assert.equal(globalThis.__hookVerified.length, 0);
const headers = { "x-webhook-secret": "offline-fixture" };
assert.equal((await send(valid, headers)).status, 200);
assert.deepEqual(globalThis.__hookVerified.at(-1), { id: "or_verified", hook: "hook_1" }, "Only references reach verification; notification amount/status are never accepted as payment evidence");
assert.equal((await send({ id: "hook_charge", type: "charge.refunded", data: { id: "ch_1", order: { id: "or_verified" } } }, headers)).status, 200);
assert.equal((await send({ ...valid, data: { id: "../orders" } }, headers)).status, 400);
globalThis.__hookFailure = true;
assert.equal((await send(valid, headers)).status, 502, "Provider outages must request webhook retry");
console.log("PASS: webhook configuration, authentication, malformed/oversized events, order/charge delegation and retryable provider failure; notification bodies cannot approve payments.");
