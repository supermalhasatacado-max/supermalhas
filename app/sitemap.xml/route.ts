import { getSettings, getProducts, seed } from "@/lib/shop/server";
import { siteOrigin } from "@/lib/env";
export const dynamic = "force-dynamic";
export async function GET() {
  await seed();
  const s = await getSettings(),
    origin = siteOrigin();
  const escape = (v: string) =>
    v.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&apos;",
        })[c]!,
    );
  const paths = s.salesEnabled
    ? [
        "",
        "/camisetas",
        "/sobre",
        "/atacado",
        "/contato",
        ...(await getProducts()).map((p) => `/produto/${p.slug}`),
      ]
    : [];
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${escape(origin + path)}</loc></url>`).join("")}</urlset>`,
    {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}
