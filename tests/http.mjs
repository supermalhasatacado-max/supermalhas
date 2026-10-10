import assert from "node:assert/strict";

// Read-only HTTP checks. Never change stock/settings or create customer records.
const base = new URL(process.env.TEST_URL || "http://localhost:3000").origin;
const local = ["localhost", "127.0.0.1"].includes(new URL(base).hostname);
assert(local || process.env.TEST_ALLOW_REMOTE === "true", "Set TEST_ALLOW_REMOTE=true to verify an explicitly selected deployed store.");
let checks = 0;
async function request(path, expected, options = {}) {
  const response = await fetch(base + path, { redirect: "manual", signal: AbortSignal.timeout(30000), ...options });
  assert.equal(response.status, expected, `${path}: HTTP ${response.status}`);
  checks++;
  return response;
}
const health = await (await request("/api/health", 200)).json();
assert.equal(health.database, "connected");
assert.equal(health.storage, "private");
assert.equal(health.auth, true);
assert(health.products >= 3);
const bootstrapResponse = await request("/api/shop/bootstrap", 200);
const bootstrap = await bootstrapResponse.json();
assert.equal(bootstrap.admin, false);
assert(bootstrap.products.length >= 3);
assert(!("fiscalEmail" in bootstrap.settings) || bootstrap.settings.fiscalEmail === "");
assert(bootstrapResponse.headers.get("cache-control")?.includes("no-store"));
await request("/api/shop/admin/dashboard", 403);
await request("/api/shop/admin/dashboard", 403, { headers: {
  Cookie: "__sites_local_auth=1",
  "oai-authenticated-user-id": "local_seedy",
  "oai-authenticated-user-email": "supermalhasatacado@gmail.com",
}});
await request("/api/shop/profile", 401);
await request("/api/media", 403, { method: "POST", headers: { Origin: base, "Content-Type": "image/png" } });
const product = bootstrap.products[0];
const pieces = product.pieces / 4;
const item = { productId: product.id, quantity: 1, grade: { P: pieces, M: pieces, G: pieces, GG: pieces } };
const quote = await (await request("/api/shop/quote", 200, {
  method: "POST", headers: { Origin: base, "Content-Type": "application/json" }, body: JSON.stringify({ items: [item] }),
})).json();
assert.equal(quote.subtotal, product.price);
await request("/api/shop/quote", 400, {
  method: "POST", headers: { Origin: base, "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ ...item, price: 1 }] }),
});
await request("/auth/logout", 403, { method: "POST", headers: { Origin: "https://untrusted.example" } });
const badCallback = await request("/auth/callback?return_to=https://untrusted.example", 307);
assert.equal(new URL(badCallback.headers.get("location"), base).origin, base);
for (const path of ["/", "/camisetas", "/carrinho", "/entrar", "/minha-conta", "/admin", "/robots.txt", "/sitemap.xml"]) {
  const response = await request(path, 200);
  assert(response.headers.get("x-content-type-options") === "nosniff");
}
console.log(`PASS: ${checks} HTTP checks against ${base}: real persistence health, catalog, private routes, rejected spoofed identity, safe redirect and public pages.`);
