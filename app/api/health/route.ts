import { seed, getProducts, getSettings } from "@/lib/shop/server";
import { supabaseFetch } from "@/db/supabase";
import { authConfig } from "@/lib/auth/config";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  try {
    await seed();
    const config = authConfig();
    const [products, settings, storage, auth] = await Promise.all([
      getProducts(), getSettings(), supabaseFetch("/storage/v1/bucket/supermalhas-products"),
      config ? fetch(`${config.url}/auth/v1/settings`, { headers: { apikey: config.key }, cache: "no-store", signal: AbortSignal.timeout(5000) }) : null,
    ]);
    const bucket = storage.ok ? await storage.json() as { public?: boolean } : null;
    const authSettings = auth?.ok ? await auth.json() as { external?: { email?: boolean }; mailer_autoconfirm?: boolean } : null;
    const authReady = authSettings?.external?.email === true && authSettings.mailer_autoconfirm === false;
    const ready = authReady && bucket?.public === false;
    return Response.json({ status: ready ? "ok" : "incomplete", database: "connected", storage: bucket?.public === false ? "private" : "unavailable", auth: authReady, products: products.length, salesEnabled: settings.salesEnabled }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
