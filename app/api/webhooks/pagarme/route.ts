import { env } from "cloudflare:workers";
import { db, seed, rateLimit, ShopError } from "@/lib/shop/server";
import { verifyProviderOrder } from "@/lib/shop/payments";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    if (!env.PAGARME_SECRET_KEY)
      return Response.json(
        { error: "Pagamento ainda não configurado." },
        { status: 503 },
      );
    if (
      env.PAGARME_WEBHOOK_SECRET &&
      request.headers.get("x-webhook-secret") !== env.PAGARME_WEBHOOK_SECRET
    )
      return Response.json({ error: "Não autorizado." }, { status: 401 });
    await seed();
    await rateLimit(request, "webhook", 120);
    const text = await request.text();
    if (text.length > 256000) return new Response(null, { status: 413 });
    const hook = JSON.parse(text);
    if (
      typeof hook.id !== "string" ||
      hook.id.length > 150 ||
      typeof hook.type !== "string"
    )
      return Response.json({ error: "Evento inválido." }, { status: 400 });
    // Notification content never establishes a payment status. Fetch the referenced order from the authenticated Pagar.me API first.
    const providerId = hook.type.startsWith("order.")
      ? hook.data?.id
      : hook.data?.order?.id;
    if (providerId) await verifyProviderOrder(providerId, hook.id);
    return Response.json({ received: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof ShopError
            ? error.message
            : "Não foi possível verificar o evento.",
      },
      { status: error instanceof ShopError ? error.status : 502 },
    );
  }
}
