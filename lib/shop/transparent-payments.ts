import { env } from "@/lib/env";
import { db, decodeOrder, event, now, paymentEnvironment, ShopError } from "./server";
import { pagarme, verifyProviderOrder } from "./payments";
import { safePaymentDetails } from "./payment-data";
import type { Order } from "./types";

export function transparentCheckoutEnabled() {
  return env.PAGARME_CHECKOUT_MODE === "transparent" && /^pk_[A-Za-z0-9]+$/.test(env.PAGARME_PUBLIC_KEY || "");
}
export function providerCustomer(order: Order) {
  const c = order.customer, a = order.address, phone = c.phone.replace(/\D/g, "");
  return {
    name: c.name, email: c.email, type: c.type, document: c.document.replace(/\D/g, ""),
    document_type: c.type === "company" ? "CNPJ" : "CPF", code: order.number,
    phones: { mobile_phone: { country_code: "55", area_code: phone.slice(0, 2), number: phone.slice(2) } },
    address: { country: "BR", state: a.state, city: a.city, zip_code: a.zip.replace(/\D/g, ""), line_1: `${a.number}, ${a.street}, ${a.district}`, line_2: a.complement },
  };
}
export function transparentOrderPayload(order: Order, cardId?: string, customerId?: string) {
  const config = order.payment_config;
  if (config?.checkout !== "transparent") throw new ShopError("Modalidade de pagamento incompatível.", 409);
  const installment = config.installments.find(p => p.number === (config.selectedInstallments || 1));
  if (!installment) throw new ShopError("Parcelamento inválido.");
  const total = order.payment_method === "credit_card" ? installment.total : order.total;
  return {
    code: order.number, closed: true,
    items: [{ code: order.number, description: `Pedido ${order.number} • Super Malhas`, amount: total, quantity: 1 }],
    ...(customerId ? { customer_id: customerId } : { customer: providerCustomer(order) }),
    payments: [{
      payment_method: order.payment_method, amount: total,
      ...(order.payment_method === "pix" ? { pix: { expires_in: config.pixMinutes * 60 } } : {}),
      ...(order.payment_method === "boleto" ? { boleto: { due_at: config.expiresAt, instructions: `Pedido ${order.number}. Pague até o vencimento.`, document_number: order.number, type: "DM" } } : {}),
      ...(order.payment_method === "credit_card" ? { credit_card: { card_id: cardId, installments: installment.number, operation_type: "auth_and_capture", statement_descriptor: "SUPERMALHAS", auto_recovery: false } } : {}),
    }],
  };
}
async function persistProviderPayment(order: Order, provider: Record<string, any>) {
  if (!/^or_[A-Za-z0-9]+$/.test(provider.id) || provider.code !== order.number)
    throw new ShopError("O pagamento precisa ser conferido pelo atendimento.", 502);
  await verifyProviderOrder(provider.id);
  const transaction = provider.charges?.find((c: { payment_method?: string }) => c.payment_method === order.payment_method)?.last_transaction;
  const details = safePaymentDetails({ method: order.payment_method, qrCode: transaction?.qr_code, qrCodeUrl: transaction?.qr_code_url,
    barcode: transaction?.line || (/^\d+$/.test(transaction?.barcode || "") ? transaction.barcode : undefined), boletoUrl: transaction?.pdf || transaction?.url,
    expiresAt: transaction?.expires_at || transaction?.due_at });
  if (details && (details.method === "credit_card" || (details.method === "pix" && (details.qrCode || details.qrCodeUrl)) || (details.method === "boleto" && (details.barcode || details.boletoUrl))))
    await event(order.id, "payment.instructions", JSON.stringify(details), `payment-instructions:${order.id}`);
}
export async function createTransparentPayment(input: Order, cardToken?: string) {
  const raw = await db().prepare("SELECT * FROM orders WHERE id=?").bind(input.id).first<Record<string, unknown>>();
  if (!raw || raw.demo || raw.provider_environment !== paymentEnvironment()) throw new ShopError("Pedido ou ambiente de pagamento inválido.", 409);
  const order = decodeOrder(raw);
  if (order.payment_config?.checkout !== "transparent" || raw.provider_link_id) throw new ShopError("Este pedido utiliza outro checkout.", 409);
  if (raw.provider_order_id) {
    await persistProviderPayment(order, await pagarme(`/orders/${encodeURIComponent(String(raw.provider_order_id))}`));
    return;
  }
  if (!["creating", "pending"].includes(order.payment_status)) throw new ShopError("Este pedido não permite um novo pagamento.", 409);
  const events = await db().prepare("SELECT * FROM order_events WHERE order_id=? ORDER BY created_at ASC").bind(order.id).all<{ type: string }>();
  const attempt = events.results.filter(e => e.type === "payment.direct_rejected").length;
  const claim = await db().prepare("INSERT OR IGNORE INTO order_events (id,order_id,type,note,created_at) VALUES (?,?,?,?,?)")
    .bind(`direct-payment:${order.id}:${attempt}`, order.id, "payment.preparing", "Preparando pagamento seguro.", now()).run();
  let provider;
  if (!claim.meta.changes) {
    const found = await pagarme(`/orders?code=${encodeURIComponent(order.number)}&size=10`);
    const matches = (found.data || []).filter((p: { code?: string }) => p.code === order.number);
    if (matches.length !== 1) throw new ShopError("O pagamento está sendo conferido. Atualize este pedido antes de tentar novamente.", 409);
    provider = await pagarme(`/orders/${encodeURIComponent(matches[0].id)}`);
  } else {
    // A token is only used to create a provider card. Never persist it, include
    // it in events, return it, or accept unencrypted card fields on this server.
    let orderSubmitted = false;
    try {
      let cardId, customerId;
      if (order.payment_method === "credit_card") {
        if (!cardToken || !/^token_[A-Za-z0-9]+$/.test(cardToken)) throw new ShopError("Preencha novamente os dados do cartão.");
        const customer = await pagarme("/customers", providerCustomer(order), `sm-customer-${order.id}`);
        if (!/^cus_[A-Za-z0-9]+$/.test(customer.id)) throw new ShopError("Não foi possível preparar o comprador.", 502);
        customerId = customer.id;
        const card = await pagarme(`/customers/${customerId}/cards`, { token: cardToken, billing_address: providerCustomer(order).address }, `sm-card-${order.id}-${attempt}`);
        if (!/^card_[A-Za-z0-9]+$/.test(card.id)) throw new ShopError("Não foi possível validar o cartão.", 502);
        cardId = card.id;
      }
      orderSubmitted = true;
      provider = await pagarme("/orders", transparentOrderPayload(order, cardId, customerId), `sm-direct-${order.id}-${attempt}`);
    } catch (error) {
      if (!orderSubmitted || (error instanceof ShopError && (error.status === 400 || ("definiteRejection" in error && error.definiteRejection))))
        await event(order.id, "payment.direct_rejected", "Pagamento não iniciado. É possível tentar novamente com os dados corrigidos.", `direct-rejected:${order.id}:${attempt}`);
      throw error;
    }
  }
  await persistProviderPayment(order, provider);
}
