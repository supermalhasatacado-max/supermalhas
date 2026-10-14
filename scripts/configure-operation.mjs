import assert from "node:assert/strict";
import fs from "node:fs";
import { build } from "esbuild";

assert.equal(new URL(process.env.SUPABASE_URL).hostname, "ihjmwbyactdbltghundz.supabase.co");
const operation = JSON.parse(fs.readFileSync("docs/operacao-20261014.json", "utf8"));
const compiled = await build({
  stdin: { contents: "export * from './lib/shop/server'; export * from './lib/shop/validation';", resolveDir: process.cwd() },
  bundle: true, write: false, platform: "node", format: "esm",
  plugins: [{ name: "server-context", setup(b) {
    b.onResolve({ filter: /^@\/lib\/env$/ }, () => ({ path: "env", namespace: "fixture" }));
    b.onResolve({ filter: /^@\/lib\/auth\/user$/ }, () => ({ path: "auth", namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, a => ({ contents: a.path === "env" ? "export const env=process.env" : "export async function getStoreUser(){return null}", loader: "js" }));
  } }],
});
const shop = await import("data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].text).toString("base64"));
const before = await shop.getSettings();
assert.equal(before.salesEnabled, false, "Não executar ajuste inicial sobre uma loja com vendas ativas.");
const products = await shop.getProducts(true);
for (const p of products) {
  assert(Number.isInteger(operation.stockPackages[p.id]), "Produto não previsto na configuração aprovada.");
  assert(p.stock === 0 || p.stock === operation.stockPackages[p.id], "O estoque já mudou; confira antes de substituir.");
}
const { stockPackages, inventoryNote, shippingRules, ...fields } = operation;
const includeShipping = process.argv.includes("--include-shipping");
const next = shop.settingsSchema.parse({ ...before, ...fields, ...(includeShipping ? { shippingRules } : {}) });
console.log(JSON.stringify({ apply: process.argv.includes("--apply"), includeShipping, email: next.email, salesEnabled: next.salesEnabled, inventory: stockPackages, inventoryNote, policies: ["shippingPolicy", "returnPolicy", "privacyPolicy", "terms"].map(k => ({ key: k, characters: next[k].length })) }));
if (process.argv.includes("--apply")) {
  const database = shop.db();
  const upsert = "INSERT INTO products (id,slug,title,pieces,price,stock,active,featured,description,image,specs,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,pieces=excluded.pieces,price=excluded.price,stock=excluded.stock,active=excluded.active,featured=excluded.featured,description=excluded.description,image=excluded.image,specs=excluded.specs,updated_at=excluded.updated_at";
  await database.batch([
    database.prepare("UPDATE settings SET data=? WHERE key='store'").bind(JSON.stringify(next)),
    ...products.map(p => database.prepare(upsert).bind(p.id, p.slug, p.title, p.pieces, p.price, stockPackages[p.id], p.active, p.featured, p.description, p.image, JSON.stringify(p.specs), new Date().toISOString())),
  ]);
  assert.deepEqual(await shop.getSettings(), next);
  assert.deepEqual(Object.fromEntries((await shop.getProducts(true)).map(p => [p.id, p.stock])), stockPackages);
  console.log("PASS: operação gravada e relida no Supabase; vendas permanecem desativadas até homologação.");
}
