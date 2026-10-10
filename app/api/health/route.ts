import { seed, getProducts, getSettings } from "@/lib/shop/server";
import { supabaseFetch } from "@/db/supabase";
import { authConfig } from "@/lib/auth/config";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  try {
    await seed();
    const [products, settings, storage] = await Promise.all([getProducts(), getSettings(), supabaseFetch("/storage/v1/bucket/supermalhas-products")]);
    const bucket = storage.ok ? await storage.json() as { public?: boolean } : null;
    const ready = !!authConfig() && bucket?.public === false;
    return Response.json({ status: ready ? "ok" : "incomplete", database: "connected", storage: bucket?.public === false ? "private" : "unavailable", auth: !!authConfig(), products: products.length, salesEnabled: settings.salesEnabled }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
