import { getSettings } from "@/lib/shop/server";
import { siteOrigin } from "@/lib/env";
export const dynamic = "force-dynamic";
export async function GET() {
  const s = await getSettings();
  const content = s.salesEnabled
    ? `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /checkout\nDisallow: /carrinho\nDisallow: /pedido/\nDisallow: /minha-conta\nDisallow: /entrar\nDisallow: /auth/\nDisallow: /api/\nSitemap: ${siteOrigin()}/sitemap.xml\n`
    : "User-agent: *\nDisallow: /\n";
  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
