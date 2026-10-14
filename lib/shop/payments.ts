import { env } from "@/lib/env";
import {
  db,
  now,
  event,
  uid,
  ShopError,
  paymentEnvironment,
  getSettings,
  decodeOrder,
} from "./server";
import type { Order, StoreSettings } from "./types";
import { installmentTotals } from "./payment-options";
export { installmentTotals } from "./payment-options";

class PagarmeError extends ShopError {
  constructor(public definiteRejection: boolean) {
    super("Não foi possível preparar o pagamento. Confira os dados ou tente novamente pela página do pedido.", 502);
  }
}

export async function pagarme(
  path: string,
  body?: unknown,
  requestKey?: string,
  method = body ? "POST" : "GET",
) {
  if (!env.PAGARME_SECRET_KEY)
    throw new ShopError("O pagamento está aguardando configuração.", 503);
  const base =
    paymentEnvironment() === "test"
      ? "https://sdx-api.pagar.me/core/v5"
      : "https://api.pagar.me/core/v5";
  let response: Response;
  try {
    response = await fetch(base + path, {
      method,
      headers: {
        Authorization: `Basic ${btoa(env.PAGARME_SECRET_KEY + ":")}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "SuperMalhasAtacado/1.0",
        ...(requestKey ? { "Idempotency-Key": requestKey } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(method === "GET" ? 8000 : 25000),
    });
  } catch {
    throw new ShopError(
      "O Pagar.me demorou para responder. O pedido foi preservado; tente novamente pela página do pedido.",
      502,
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new PagarmeError([400, 401, 403, 404, 422].includes(response.status));
  return data as Record<string, any>;
}
export function paymentLinkPayload(
  order: Order,
  s: StoreSettings,
  origin: string,
) {
  const config = order.payment_config || {
    installments: installmentTotals(order.total, s),
    pixMinutes: s.pixMinutes,
    boletoDays: s.boletoDays,
    expiresAt: new Date(
      new Date(order.created_at).getTime() + s.boletoDays * 86400000,
    ).toISOString(),
  };
  const installments = config.installments;
  const customer = order.customer;
  const address = order.address;
  // A single immutable line guarantees that shipping and discounts match the server total exactly.
  return {
    type: "order",
    name: `Super Malhas ${order.number}`,
    order_code: order.number,
    max_paid_sessions: 1,
    max_sessions: 1,
    expires_at: config.expiresAt,
    payment_settings: {
      accepted_payment_methods: [order.payment_method],
      statement_descriptor: "SUPERMALHAS",
      ...(order.payment_method === "credit_card"
        ? {
            credit_card_settings: {
              operation_type: "auth_and_capture",
              installments,
            },
          }
        : {}),
      ...(order.payment_method === "pix"
        ? { pix_settings: { expires_in: config.pixMinutes * 60 } }
        : {}),
      ...(order.payment_method === "boleto"
        ? {
            boleto_settings: {
              due_in: config.boletoDays,
              instructions: `Pedido ${order.number}. Pagamento sujeito à compensação.`,
            },
          }
        : {}),
    },
    customer_settings: {
      customer: {
        name: customer.name,
        email: customer.email,
        type: customer.type,
        document: customer.document.replace(/\D/g, ""),
        document_type: customer.type === "company" ? "CNPJ" : "CPF",
        code: order.number,
        phones: {
          mobile_phone: {
            country_code: "55",
            area_code: customer.phone.replace(/\D/g, "").slice(0, 2),
            number: customer.phone.replace(/\D/g, "").slice(2),
          },
        },
        address: {
          country: "BR",
          state: address.state,
          city: address.city,
          zip_code: address.zip.replace(/\D/g, ""),
          line_1: `${address.number}, ${address.street}, ${address.district}`,
          line_2: address.complement,
        },
      },
    },
    cart_settings: {
      items: [
        {
          name: `Pedido ${order.number} • Super Malhas`,
          description: order.items
            .map((i) => `${i.quantity}x ${i.title} (${i.pieces} peças)`)
            .join("; ")
            .slice(0, 500),
          amount: order.total,
          default_quantity: 1,
        },
      ],
    },
    layout_settings: { primary_color: "#f26322", secondary_color: "#17191c" },
    flow_settings: { success_url: `${origin}/pedido/${order.id}` },
  };
}
export async function createPaymentLink(order: Order, origin: string) {
  if (order.demo)
    throw new ShopError("Pedidos demonstrativos não geram cobrança.");
  const raw = await db().prepare("SELECT * FROM orders WHERE id=?").bind(order.id).first<Record<string, unknown>>();
  if (!raw || raw.provider_environment !== paymentEnvironment())
    throw new ShopError("Use o ambiente Pagar.me original deste pedido.", 409);
  order = decodeOrder(raw);
  if (order.payment_link) return order.payment_link;
  if (!["creating", "pending"].includes(order.payment_status))
    throw new ShopError(
      "Este pedido não permite iniciar um novo pagamento.",
      409,
    );
  const s = await getSettings();
  const payload = paymentLinkPayload(order, s, origin);
  // Paymentlinks does not enforce Idempotency-Key. A durable, unique event
  // claims each POST across processes. Ambiguous timeouts are recovered by
  // merchant name/code; they must never trigger another POST automatically.
  const attempts = await db().prepare("SELECT * FROM order_events WHERE order_id=? ORDER BY created_at ASC").bind(order.id).all<{ id: string; type: string }>();
  const attempt = attempts.results.filter(e => e.type === "payment.link_rejected").length;
  const claim = await db().prepare("INSERT OR IGNORE INTO order_events (id,order_id,type,note,created_at) VALUES (?,?,?,?,?)")
    .bind(`payment-link:${order.id}:${attempt}`, order.id, "payment.link_creating", "Preparando checkout seguro no Pagar.me.", now()).run();
  let link;
  if (claim.meta.changes) {
    try {
      link = await pagarme("/paymentlinks", payload, `sm-${order.id}-${attempt}`);
    } catch (error) {
      if (error instanceof PagarmeError && error.definiteRejection)
        await event(order.id, "payment.link_rejected", "O provedor recusou a criação do checkout. Uma nova tentativa é permitida.", `payment-link-rejected:${order.id}:${attempt}`);
      throw error;
    }
  } else {
    const found = await pagarme(`/paymentlinks?name=${encodeURIComponent(payload.name)}&per_page=30`);
    // List responses are summaries in `content`, without order_code. Only the
    // authenticated detail response can establish the code/value/method match.
    const matches = (found.content || []).filter((candidate: Record<string, unknown>) => candidate.name === payload.name && candidate.status === "active");
    if (matches.length !== 1 || !/^pl_[A-Za-z0-9]+$/.test(matches[0].id))
      throw new ShopError("O checkout está sendo conferido no Pagar.me. Aguarde e atualize o pedido. Se persistir, fale com o atendimento; não é necessário refazer a compra.", 409);
    link = await pagarme(`/paymentlinks/${encodeURIComponent(matches[0].id)}`);
    if (link.order_code !== order.number || link.cart_settings?.total_cost !== order.total ||
      link.payment_settings?.accepted_payment_methods?.length !== 1 || link.payment_settings.accepted_payment_methods[0] !== order.payment_method)
      throw new ShopError("O checkout exige conferência do atendimento.", 409);
  }
  let url: URL;
  try {
    url = new URL(link.url);
  } catch {
    throw new ShopError("O provedor retornou uma URL inválida.", 502);
  }
  if (url.protocol !== "https:" || !url.hostname.endsWith(".pagar.me"))
    throw new ShopError("O provedor retornou uma URL inválida.", 502);
  const saved = await db()
    .prepare(
      "UPDATE orders SET payment_link=?,provider_link_id=?,provider_environment=?,payment_status='pending',updated_at=? WHERE id=? AND payment_link IS NULL",
    )
    .bind(url.href, link.id, paymentEnvironment(), now(), order.id)
    .run();
  if (saved.meta.changes) await event(
    order.id,
    "payment.pending",
    "Checkout Pagar.me preparado. Aguardando pagamento.",
  );
  return url.href;
}
export async function releaseReservation(id: string) {
  const raw = await db()
    .prepare("SELECT * FROM orders WHERE id=?")
    .bind(id)
    .first<Record<string, unknown>>();
  if (!raw) return;
  const order = decodeOrder(raw);
  const database = db();
  const statements = order.items.reduce(
    (m, i) => m.set(i.productId, (m.get(i.productId) || 0) + i.quantity),
    new Map<string, number>(),
  );
  const condition =
    "id=? AND reserved=1 AND fulfillment IN ('new','processing') AND payment_status IN ('canceled','failed','refunded')";
  const results = await database.batch([
    ...Array.from(statements, ([productId, qty]) =>
      database
        .prepare(
          `UPDATE products SET stock=stock+? WHERE id=? AND EXISTS (SELECT 1 FROM orders WHERE ${condition})`,
        )
        .bind(qty, productId, id),
    ),
    ...(raw.coupon_code
      ? [
          database
            .prepare(
              `UPDATE coupons SET used=MAX(0,used-1) WHERE code=? AND EXISTS (SELECT 1 FROM orders WHERE ${condition} AND payment_status!='refunded')`,
            )
            .bind(raw.coupon_code, id),
        ]
      : []),
    database
      .prepare(
        `UPDATE orders SET reserved=0,fulfillment='canceled',updated_at=? WHERE ${condition}`,
      )
      .bind(now(), id),
  ]);
  if (results.at(-1)?.meta.changes)
    await event(
      id,
      "inventory.released",
      "Reserva liberada. Os pacotes retornaram ao estoque disponível.",
    );
}
export async function verifyProviderOrder(providerId: string, hookId?: string) {
  if (!/^or_[A-Za-z0-9]+$/.test(providerId))
    throw new ShopError("Referência de pagamento inválida.");
  const provider = await pagarme(`/orders/${encodeURIComponent(providerId)}`);
  const raw = await db()
    .prepare("SELECT * FROM orders WHERE number=? AND demo=0")
    .bind(provider.code || "")
    .first<Record<string, unknown>>();
  if (!raw) return;
  if (raw.provider_environment !== paymentEnvironment())
    throw new ShopError("Ambiente do pagamento diverge do pedido.", 409);
  const order = decodeOrder(raw);
  const allowed =
    order.payment_method === "credit_card"
      ? order.payment_config?.installments.filter(x => order.payment_config?.checkout !== "transparent" || x.number === order.payment_config.selectedInstallments).map((x) => x.total) || [order.total]
      : [order.total];
  if (
    !allowed.includes(Number(provider.amount)) ||
    provider.currency !== "BRL"
  ) {
    await db()
      .prepare(
        "UPDATE orders SET payment_status='review',updated_at=? WHERE id=?",
      )
      .bind(now(), order.id)
      .run();
    await event(
      order.id,
      "payment.review",
      "Valor do provedor diverge do pedido. Conferência necessária.",
      hookId,
    );
    return;
  }
  if (raw.provider_order_id && raw.provider_order_id !== provider.id)
    throw new ShopError(
      "Pagamento já associado a outro pedido do provedor.",
      409,
    );
  let status = String(provider.status || "pending").toLowerCase();
  if (provider.charges?.some((c: any) => c.status === "chargedback"))
    status = "disputed";
  else if (
    provider.charges?.length &&
    provider.charges.every((c: any) => c.status === "refunded")
  )
    status = "refunded";
  if (
    !["paid", "pending", "failed", "canceled", "refunded", "disputed"].includes(
      status,
    )
  )
    status = "pending";
  if (
    ["refunded", "disputed"].includes(order.payment_status) &&
    !["refunded", "disputed"].includes(status)
  )
    return;
  if (
    order.payment_status === "paid" &&
    ["pending", "failed", "canceled"].includes(status)
  )
    return;
  if (status === "paid" && !raw.reserved && !order.sandbox) status = "review";
  const old = order.payment_status;
  const updated = await db()
    .prepare(
      "UPDATE orders SET provider_order_id=?,payment_status=?,charged_total=?,updated_at=? WHERE id=? AND payment_status=? AND (provider_order_id IS NULL OR provider_order_id=?)",
    )
    .bind(
      provider.id,
      status,
      Number(provider.amount),
      now(),
      order.id,
      old,
      provider.id,
    )
    .run();
  if (!updated.meta.changes) return;
  if (["canceled", "refunded", "failed"].includes(status))
    await releaseReservation(order.id);
  if (old !== status) {
    await event(
      order.id,
      `payment.${status}`,
      status === "review"
        ? "Pagamento recebido após liberação da reserva. Conferência do estoque necessária."
        : `Status confirmado pelo Pagar.me: ${status}.`,
      hookId ? `${paymentEnvironment()}:${hookId}` : uid(),
    );
    if (status === "paid")
      await sendOrderEmail(
        { ...order, payment_status: "paid" },
        "Pagamento aprovado",
      );
  }
}
export async function syncOrder(id: string) {
  const raw = await db()
    .prepare("SELECT * FROM orders WHERE id=?")
    .bind(id)
    .first<Record<string, unknown>>();
  if (!raw || raw.demo || !env.PAGARME_SECRET_KEY) return;
  if (raw.provider_environment !== paymentEnvironment())
    throw new ShopError(
      "Use o ambiente Pagar.me original para consultar este pedido.",
      409,
    );
  if (raw.provider_order_id) {
    await verifyProviderOrder(String(raw.provider_order_id));
    return;
  }
  // The API supports filtering orders by the merchant order code. Each result is fetched independently before trusting its status.
  const result = await pagarme(
    `/orders?code=${encodeURIComponent(String(raw.number))}&size=10`,
  );
  for (const order of result.data || [])
    if (order.code === raw.number) await verifyProviderOrder(order.id);
  // Link expiration alone cannot cancel an issued boleto. Only an unused expired link releases stock.
  const expiresAt = decodeOrder(raw).payment_config?.expiresAt;
  if (
    !result.data?.some((o: any) => o.code === raw.number) &&
    raw.provider_link_id &&
    expiresAt &&
    expiresAt < now()
  ) {
    const link = await pagarme(
      `/paymentlinks/${encodeURIComponent(String(raw.provider_link_id))}`,
    );
    if (Number(link.total_sessions) === 0 && link.status !== "active") {
      await db()
        .prepare(
          "UPDATE orders SET payment_status='canceled',updated_at=? WHERE id=? AND payment_status IN ('creating','pending')",
        )
        .bind(now(), id)
        .run();
      await releaseReservation(id);
    }
  }
}
export async function cancelUnpaidOrder(id: string, origin: string) {
  let raw = await db()
    .prepare("SELECT * FROM orders WHERE id=?")
    .bind(id)
    .first<Record<string, unknown>>();
  if (!raw) throw new ShopError("Pedido não encontrado.", 404);
  if (raw.demo) {
    await db()
      .prepare(
        "UPDATE orders SET payment_status='canceled',fulfillment='canceled',updated_at=? WHERE id=? AND demo=1",
      )
      .bind(now(), id)
      .run();
    await event(id, "demo.canceled", "Pedido demonstrativo cancelado.");
    return;
  }
  await syncOrder(id);
  raw = await db()
    .prepare("SELECT * FROM orders WHERE id=?")
    .bind(id)
    .first<Record<string, unknown>>();
  if (
    !["creating", "pending", "failed", "canceled"].includes(
      String(raw!.payment_status),
    )
  )
    throw new ShopError(
      "Este pedido exige atendimento. Estornos são realizados no painel Pagar.me.",
      409,
    );
  if (!raw!.provider_link_id) {
    if (decodeOrder(raw!).payment_config?.checkout === "transparent")
      throw new ShopError("Solicite o cancelamento ao atendimento para conferir a cobrança com o Pagar.me.", 409);
    await createPaymentLink(decodeOrder(raw!), origin);
    raw = await db()
      .prepare("SELECT * FROM orders WHERE id=?")
      .bind(id)
      .first<Record<string, unknown>>();
  }
  const currentLink = await pagarme(
    `/paymentlinks/${encodeURIComponent(String(raw!.provider_link_id))}`,
  );
  if (currentLink.status === "active")
    await pagarme(
      `/paymentlinks/${encodeURIComponent(String(raw!.provider_link_id))}/cancel`,
      undefined,
      undefined,
      "PATCH",
    );
  await syncOrder(id);
  const check = await db()
    .prepare("SELECT * FROM orders WHERE id=?")
    .bind(id)
    .first<Record<string, unknown>>();
  const link = await pagarme(
    `/paymentlinks/${encodeURIComponent(String(check!.provider_link_id))}`,
  );
  if (
    Number(link.total_sessions) > 0 &&
    !["failed", "canceled"].includes(String(check!.payment_status))
  )
    throw new ShopError(
      "O link foi desativado, mas há uma cobrança em andamento. A reserva continua até a confirmação do Pagar.me.",
      409,
    );
  if (link.status === "active")
    throw new ShopError(
      "O Pagar.me ainda não confirmou o cancelamento do link.",
      409,
    );
  await db()
    .prepare(
      "UPDATE orders SET payment_status='canceled',updated_at=? WHERE id=? AND payment_status IN ('creating','pending','failed','canceled')",
    )
    .bind(now(), id)
    .run();
  await releaseReservation(id);
  await event(
    id,
    "order.canceled",
    "Tentativa de compra cancelada após conferência no Pagar.me.",
  );
}
export async function sendOrderEmail(order: Order, subject: string) {
  const s = await getSettings();
  if (!env.RESEND_API_KEY || !s.emailFrom || order.demo || order.sandbox)
    return false;
  const escape = (v: string) =>
    v.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c]!,
    );
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `sm-${order.id}-${subject}`,
      },
      body: JSON.stringify({
        from: s.emailFrom,
        to: [order.customer.email],
        subject: `${subject} • ${order.number}`,
        html: `<h1>${escape(subject)}</h1><p>Olá, ${escape(order.customer.name)}.</p><p>Pedido <strong>${escape(order.number)}</strong> na Super Malhas Atacado.</p><p>Total: ${(order.total / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>${order.tracking_code ? `<p>Transportadora: ${escape(order.carrier || "")}<br>Rastreio: ${escape(order.tracking_code)}</p>` : ""}<p>Consulte os detalhes e o status pela sua conta na loja.</p>`,
      }),
    });
    await event(
      order.id,
      response.ok ? "email.sent" : "email.failed",
      response.ok
        ? `${subject}: e-mail enviado.`
        : "Falha no serviço de e-mail.",
    );
    return response.ok;
  } catch {
    await event(order.id, "email.failed", "Serviço de e-mail indisponível.");
    return false;
  }
}
export async function reconcileExpiredOrders() {
  if (!env.PAGARME_SECRET_KEY) return;
  await import("./server").then((m) => m.seed());
  const minute = Math.floor(Date.now() / 60000);
  const claim = await db()
    .prepare(
      "INSERT OR IGNORE INTO rate_limits (id,count,expires_at) VALUES (?,1,?)",
    )
    .bind(`maintenance:${minute}`, Date.now() + 120000)
    .run();
  if (!claim.meta.changes) return;
  const rows = await db()
    .prepare(
      "SELECT id FROM orders WHERE demo=0 AND reserved=1 AND payment_status IN ('creating','pending') AND provider_environment=? AND json_extract(payment_config,'$.expiresAt')<? ORDER BY created_at LIMIT 3",
    )
    .bind(paymentEnvironment(), now())
    .all<{ id: string }>();
  await Promise.allSettled(rows.results.map((r) => syncOrder(r.id)));
}
