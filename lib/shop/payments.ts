import { env } from "@/lib/env";
import { db, decodeOrder, paymentEnvironment, now, ShopError } from "./server";
import * as legacy from "./pagarme-payments";
import { verifyPicpayOrder, PicpayError } from "./picpay";
export { installmentTotals, releaseReservation, sendOrderEmail, verifyProviderOrder, paymentLinkPayload, pagarme } from "./pagarme-payments";

export async function createPaymentLink(order: import("./types").Order, origin: string) {
  if (order.payment_config?.provider === "picpay") throw new ShopError("Este pedido utiliza o pagamento PicPay dentro da loja.", 409);
  return legacy.createPaymentLink(order, origin);
}
export async function syncOrder(id: string) {
  const raw = await db().prepare("SELECT * FROM orders WHERE id=?").bind(id).first<Record<string, unknown>>();
  if (!raw || raw.demo) return;
  if (decodeOrder(raw).payment_config?.provider === "picpay") {
    try { await verifyPicpayOrder(id); }
    catch (error) {
      if (error instanceof PicpayError && error.providerStatus === 404 && !raw.provider_order_id) return;
      throw error;
    }
  } else await legacy.syncOrder(id);
}
export async function cancelUnpaidOrder(id: string, origin: string) {
  const raw = await db().prepare("SELECT * FROM orders WHERE id=?").bind(id).first<Record<string, unknown>>();
  if (!raw) throw new ShopError("Pedido não encontrado.", 404);
  if (decodeOrder(raw).payment_config?.provider !== "picpay") return legacy.cancelUnpaidOrder(id, origin);
  await syncOrder(id);
  const current = await db().prepare("SELECT * FROM orders WHERE id=?").bind(id).first<Record<string, unknown>>();
  if (["canceled", "failed"].includes(String(current?.payment_status))) { await legacy.releaseReservation(id); return; }
  // PicPay cancellation may refund an already-paid charge in a race. Only the
  // merchant may initiate financial refunds; pending reservations stay intact.
  throw new ShopError("Solicite o cancelamento ao atendimento. A reserva será liberada quando o PicPay confirmar a expiração ou o cancelamento da cobrança.", 409);
}
export async function reconcileExpiredOrders() {
  if (env.PAGARME_SECRET_KEY) await legacy.reconcileExpiredOrders();
  if (!env.PICPAY_CLIENT_ID || !env.PICPAY_CLIENT_SECRET) return;
  const minute = Math.floor(Date.now() / 60000);
  const claim = await db().prepare("INSERT OR IGNORE INTO rate_limits (id,count,expires_at) VALUES (?,1,?)")
    .bind(`picpay-maintenance:${minute}`, Date.now() + 120000).run();
  if (!claim.meta.changes) return;
  const rows = await db().prepare("SELECT id FROM orders WHERE demo=0 AND reserved=1 AND payment_status IN ('creating','pending') AND provider_environment=? AND json_extract(payment_config,'$.expiresAt')<? ORDER BY created_at LIMIT 3")
    .bind(paymentEnvironment(), now()).all<{ id: string }>();
  await Promise.allSettled(rows.results.map(r => syncOrder(r.id)));
}
