import { isIP } from "node:net";
import { env, siteOrigin } from "@/lib/env";
import { db, decodeOrder, event, now, uid, ShopError, paymentEnvironment } from "./server";
import { releaseReservation, sendOrderEmail } from "./pagarme-payments";
import { safePaymentDetails } from "./payment-data";
import type { Order } from "./types";

export class PicpayError extends ShopError {
  constructor(public providerStatus: number) {
    super("Não foi possível preparar o pagamento no PicPay. Confira os dados ou tente novamente pela página do pedido.", 502);
  }
}
export function picpayCardReady() {
  return /^\d{14}$/.test(env.PICPAY_MERCHANT_CNPJ || "") &&
    !!env.PICPAY_TRANSPARENT_TOKEN?.trim();
}
function configuration(environment = paymentEnvironment()) {
  if (!["test", "production"].includes(environment)) throw new ShopError("Ambiente PicPay inválido.", 503);
  return {
    host: environment === "test" ? "https://checkout-api-sandbox.picpay.com" : "https://checkout-api.picpay.com",
    prefix: "/api/v1",
    clientId: env.PICPAY_CLIENT_ID?.trim(), secret: env.PICPAY_CLIENT_SECRET?.trim(),
  };
}
// Cache only in server memory, keyed by environment and credentials; concurrent
// calls in one instance share a renewal. Tokens never enter application data.
let cached: { key: string; token: string; until: number } | undefined;
let renewing: { key: string; promise: Promise<string> } | undefined;
async function accessToken(environment: string) {
  const c = configuration(environment);
  if (!c.clientId || !c.secret) throw new ShopError("O PicPay está aguardando configuração.", 503);
  const key = `${environment}:${c.clientId}:${c.secret}`;
  if (cached?.key === key && cached.until > Date.now()) return cached.token;
  if (renewing?.key === key) return renewing.promise;
  const promise = (async () => {
    let response: Response;
    try {
      response = await fetch(`${c.host}/oauth2/token`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ grant_type: "client_credentials", client_id: c.clientId, client_secret: c.secret }),
        signal: AbortSignal.timeout(10000), cache: "no-store", redirect: "error",
      });
    } catch { throw new ShopError("Não foi possível conectar ao PicPay. Tente novamente em instantes.", 502); }
    const body = await response.json().catch(() => ({}));
    if (!response.ok || typeof body.access_token !== "string" || !body.access_token.length)
      throw new ShopError("Não foi possível autenticar o PicPay. O atendimento precisa conferir a configuração.", 503);
    const seconds = Math.min(Number(body.expires_in) || 300, 300);
    cached = { key, token: body.access_token, until: Date.now() + Math.max(0, seconds - 30) * 1000 };
    return cached.token;
  })();
  renewing = { key, promise };
  try { return await promise; } finally { if (renewing?.promise === promise) renewing = undefined; }
}
export async function picpay(path: string, body?: unknown, environment = paymentEnvironment()) {
  const c = configuration(environment);
  const token = await accessToken(environment);
  let response: Response;
  try {
    response = await fetch(`${c.host}${c.prefix}${path}`, {
      method: body ? "POST" : "GET", headers: {
        Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json",
      }, ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(body ? 25000 : 10000), cache: "no-store", redirect: "error",
    });
  } catch { throw new ShopError("O PicPay demorou para responder. Seu pedido foi preservado; atualize o pagamento antes de tentar novamente.", 502); }
  if (!response.ok) {
    if (response.status === 401 && cached?.token === token) cached = undefined;
    throw new PicpayError(response.status);
  }
  const result = await response.json().catch(() => null);
  if (!result || typeof result !== "object") throw new ShopError("Resposta PicPay incompleta. Atualize o pedido.", 502);
  return result as Record<string, any>;
}
export function picpayPayload(order: Order, cardToken?: string, request?: Request) {
  const config = order.payment_config;
  if (config?.provider !== "picpay" || config.checkout !== "transparent") throw new ShopError("Modalidade de pagamento incompatível.", 409);
  const c = order.customer, a = order.address, phone = c.phone.replace(/\D/g, "");
  const plan = config.installments.find(p => p.number === config.selectedInstallments);
  if (!plan) throw new ShopError("Parcelamento inválido.");
  if (order.payment_method === "credit_card" && (!picpayCardReady() || !/^card_t\/[A-Za-z0-9.\/_+\-]+$/.test(cardToken || "")))
    throw new ShopError("O cartão precisa ser validado novamente no PicPay. Escolha outra forma de pagamento se necessário.");
  const amount = order.payment_method === "credit_card" ? plan.total : order.total;
  const ip = env.VERCEL ? request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() :
    env.CLOUDFLARE ? request?.headers.get("cf-connecting-ip") : undefined;
  return {
    paymentSource: "GATEWAY", merchantChargeId: order.id,
    customer: { name: c.name, email: c.email, document: c.document.replace(/\D/g, ""), documentType: c.type === "company" ? "CNPJ" : "CPF",
      phone: { countryCode: "55", areaCode: phone.slice(0, 2), number: phone.slice(2), type: "MOBILE" } },
    ...(ip && isIP(ip) ? { deviceInformation: { ip } } : {}),
    ...(order.payment_method === "wallet" ? { expiration: config.pixMinutes * 60 } : {}),
    ...(order.payment_method === "credit_card" ? { billingUrlAddress: siteOrigin(), lateCapture: false } : {}),
    transactions: [{ amount,
      ...(order.payment_method === "pix" ? { pix: { expiration: config.pixMinutes * 60 } } : { paymentType: order.payment_method === "wallet" ? "WALLET" : "CREDIT", softDescriptor: "SUPERMALHAS" }),
      ...(order.payment_method === "credit_card" ? { credit: { temporaryCardToken: cardToken,
        installmentNumber: plan.number, installmentType: plan.number === 1 ? "NONE" : "MERCHANT",
        billingAddress: { street: a.street, number: a.number, neighborhood: a.district, city: a.city, state: a.state,
          country: "Brasil", zipCode: a.zip.replace(/\D/g, ""), ...(a.complement ? { complement: a.complement } : {}) } } } : {}),
    }],
  };
}
export async function verifyPicpayOrder(merchantId: string, hookId?: string) {
  if (!/^[a-f0-9-]{36}$/i.test(merchantId)) throw new ShopError("Referência PicPay inválida.");
  const raw = await db().prepare("SELECT * FROM orders WHERE id=?").bind(merchantId).first<Record<string, unknown>>();
  if (!raw || raw.demo) return;
  const order = decodeOrder(raw);
  if (order.payment_config?.provider !== "picpay") throw new ShopError("Este pedido pertence a outro provedor.", 409);
  if (raw.provider_environment !== paymentEnvironment()) throw new ShopError("Use o ambiente PicPay original do pedido.", 409);
  const charge = await picpay(`/charge/${encodeURIComponent(order.id)}`);
  if (charge.merchantChargeId !== order.id || typeof charge.id !== "string" || !charge.id || charge.id.length > 150 ||
    (raw.provider_order_id && raw.provider_order_id !== charge.id)) throw new ShopError("A referência PicPay exige conferência do atendimento.", 409);
  const plan = order.payment_config.installments.find(p => p.number === order.payment_config!.selectedInstallments);
  const expected = order.payment_method === "credit_card" ? plan?.total : order.total;
  const expectedType = { credit_card: "CREDIT", pix: "PIX", wallet: "WALLET" }[order.payment_method];
  const transactions = Array.isArray(charge.transactions) ? charge.transactions : [];
  const original = charge.originalAmount, refund = charge.refundedAmount;
  const transaction = transactions[0];
  const matches = Number.isSafeInteger(expected) && original === expected && Number.isSafeInteger(charge.amount) &&
    Number.isSafeInteger(refund) && refund >= 0 && refund <= original && charge.amount === original - refund &&
    transactions.length === 1 && transaction.paymentType === expectedType && transaction.originalAmount === expected &&
    transaction.amount === charge.amount && transaction.refundedAmount === refund &&
    (order.payment_method !== "credit_card" || transaction.credit?.installmentNumber === plan?.number);
  let status = "pending";
  if (!matches) status = "review";
  else if (transaction.transactionStatus === "CHARGEBACK") status = "disputed";
  else if (refund === original) status = "refunded";
  else if (charge.chargeStatus === "REFUNDED" || transaction.transactionStatus === "REFUNDED") status = "review";
  else if (refund > 0 || charge.chargeStatus === "PARTIAL" || transaction.transactionStatus === "PARTIALLY_REFUNDED") status = "review";
  else if (charge.chargeStatus === "PAID" && transaction.transactionStatus === "PAID") status = "paid";
  else if (["DENIED", "ERROR"].includes(charge.chargeStatus) && ["DENIED", "ERROR"].includes(transaction.transactionStatus)) status = "failed";
  else if (["CANCELED", "EXPIRED"].includes(transaction.transactionStatus) && ["CANCELED", "PRE_AUTHORIZED"].includes(charge.chargeStatus)) status = "canceled";
  if (["refunded", "disputed"].includes(order.payment_status) && !["refunded", "disputed"].includes(status)) return;
  if (["paid", "review"].includes(order.payment_status) && ["pending", "failed", "canceled"].includes(status)) return;
  if (status === "paid" && !raw.reserved && !order.sandbox) status = "review";
  const updated = await db().prepare("UPDATE orders SET provider_order_id=?,payment_status=?,charged_total=?,updated_at=? WHERE id=? AND payment_status=? AND (provider_order_id IS NULL OR provider_order_id=?)")
    .bind(charge.id, status, matches ? original : null, now(), order.id, order.payment_status, charge.id).run();
  if (!updated.meta.changes) return;
  if (["canceled", "failed", "refunded"].includes(status)) await releaseReservation(order.id);
  if (status !== order.payment_status) {
    await event(order.id, `payment.${status}`, status === "review" ? "O pagamento PicPay exige conferência de valor, estorno parcial ou estoque pelo atendimento." : `Status confirmado pelo PicPay: ${status}.`,
      hookId ? `picpay:${paymentEnvironment()}:${hookId}:${status}` : uid());
    if (status === "paid") await sendOrderEmail({ ...order, payment_status: status }, "Pagamento aprovado");
  }
  const details = safePaymentDetails({ method: order.payment_method, qrCode: transaction?.pix?.qrCode || transaction?.wallet?.qrCode, expiresAt: transaction?.wallet?.expiresAt });
  if (matches && details && (order.payment_method === "credit_card" || details.qrCode))
    await event(order.id, "payment.instructions", JSON.stringify(details), `payment-instructions:${order.id}`);
}
export async function createPicpayPayment(input: Order, cardToken?: string, request?: Request) {
  const raw = await db().prepare("SELECT * FROM orders WHERE id=?").bind(input.id).first<Record<string, unknown>>();
  if (!raw || raw.demo || raw.provider_environment !== paymentEnvironment()) throw new ShopError("Pedido ou ambiente PicPay inválido.", 409);
  const order = decodeOrder(raw);
  if (order.payment_config?.provider !== "picpay") throw new ShopError("Este pedido pertence a outro provedor.", 409);
  if (raw.provider_order_id) { await verifyPicpayOrder(order.id); return; }
  if (!["creating", "pending"].includes(order.payment_status)) throw new ShopError("Este pedido não permite um novo pagamento.", 409);
  const events = await db().prepare("SELECT * FROM order_events WHERE order_id=? ORDER BY created_at ASC").bind(order.id).all<{ id: string; type: string }>();
  const attempt = events.results.filter(e => e.type === "picpay.rejected").length;
  if (events.results.some(e => e.id === `picpay-create:${order.id}:${attempt}`)) {
    try { await verifyPicpayOrder(order.id); return; }
    catch (error) {
      if (error instanceof PicpayError && [404, 422].includes(error.providerStatus))
        throw new ShopError("O pagamento está sendo conferido no PicPay. Atualize este pedido; não é necessário refazer a compra.", 409);
      throw error;
    }
  }
  // One durable claim per attempt. Never repeat a POST after a timeout/5xx;
  // retrieve the same merchantChargeId instead. No undocumented idempotency header.
  const payload = picpayPayload(order, cardToken, request);
  // Authentication failures occur before claiming a provider POST, so fixing
  // credentials never strands an order whose charge was not submitted.
  await accessToken(paymentEnvironment());
  const claim = await db().prepare("INSERT OR IGNORE INTO order_events (id,order_id,type,note,created_at) VALUES (?,?,?,?,?)")
    .bind(`picpay-create:${order.id}:${attempt}`, order.id, "payment.preparing", "Preparando pagamento seguro no PicPay.", now()).run();
  if (claim.meta.changes) {
    try { await picpay(order.payment_method === "credit_card" ? "/charge/authorization" : `/charge/${order.payment_method}`, payload); }
    catch (error) {
      if (error instanceof PicpayError && [400, 401, 403].includes(error.providerStatus))
        await event(order.id, "picpay.rejected", "Criação recusada pelo PicPay. Confira os dados antes de tentar novamente.", `picpay-rejected:${order.id}:${attempt}`);
      throw error;
    }
  }
  try { await verifyPicpayOrder(order.id); }
  catch (error) {
    if (error instanceof PicpayError && [404, 422].includes(error.providerStatus))
      throw new ShopError("O pagamento está sendo conferido no PicPay. Atualize este pedido; não é necessário refazer a compra.", 409);
    throw error;
  }
}
