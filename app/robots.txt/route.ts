import { getSettings } from "@/lib/shop/server";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const s = await getSettings();
  const content = s.salesEnabled
    ? `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /checkout\nDisallow: /carrinho\nDisallow: /pedido/\nDisallow: /minha-conta\nDisallow: /api/\nSitemap: ${new URL(request.url).origin}/sitemap.xml\n`
    : "User-agent: *\nDisallow: /\n";
  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
