import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { seed, rateLimit, ShopError } from "@/lib/shop/server";
import { verifyPicpayOrder } from "@/lib/shop/picpay";
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    if (!env.PICPAY_CLIENT_ID || !env.PICPAY_CLIENT_SECRET || !env.PICPAY_WEBHOOK_TOKEN)
      return Response.json({ error: "Notificações PicPay ainda não configuradas." }, { status: 503 });
    const expected = Buffer.from(env.PICPAY_WEBHOOK_TOKEN), supplied = Buffer.from(request.headers.get("authorization") || "");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
      return Response.json({ error: "Não autorizado." }, { status: 401 });
    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) return new Response(null, { status: 415 });
    const text = await request.text();
    if (text.length > 256000) return new Response(null, { status: 413 });
    let hook;
    try { hook = JSON.parse(text); } catch { return Response.json({ error: "Evento inválido." }, { status: 400 }); }
    if (!hook || typeof hook !== "object" || typeof hook.id !== "string" || !hook.id.length || hook.id.length > 150 ||
      !["PAYMENT", "REFUND"].includes(hook.type) || typeof hook.data?.merchantChargeId !== "string" || !/^[a-f0-9-]{36}$/i.test(hook.data.merchantChargeId))
      return Response.json({ error: "Evento inválido." }, { status: 400 });
    await seed();
    await rateLimit(request, "picpay-webhook", 120);
    // The notification carries references only. Approval, amount, method and
    // refunds are verified independently through the authenticated GET charge.
    await verifyPicpayOrder(hook.data.merchantChargeId, hook.id);
    return Response.json({ received: true });
  } catch (error) {
    return Response.json({ error: error instanceof ShopError ? error.message : "Não foi possível conferir o evento PicPay." },
      { status: error instanceof ShopError ? error.status : 502 });
  }
}
