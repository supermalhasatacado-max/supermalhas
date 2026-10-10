import { checkoutSchema } from "./validation";
import {
  db,
  owner,
  cartItems,
  getDiscount,
  getSettings,
  getProducts,
  shippingQuotes,
  launchIssues,
  uid,
  now,
  ShopError,
  event,
  getOrder,
  paymentEnvironment,
  sandboxEnabled,
} from "./server";
import { createPaymentLink, installmentTotals } from "./payments";

export async function checkout(request: Request, input: unknown) {
  const data = checkoutSchema.parse(input),
    who = await owner(request),
    database = db();
  if (who.cookie)
    throw new ShopError(
      "Sua sessão foi iniciada. Atualize a página antes de finalizar a compra.",
      409,
    );
  const existing = await database
    .prepare("SELECT id FROM orders WHERE owner_key=? AND request_key=?")
    .bind(who.key, data.requestKey)
    .first<{ id: string }>();
  if (existing)
    return { order: await getOrder(existing.id, request), cookie: who.cookie };
  const s = await getSettings(),
    sandbox = sandboxEnabled(s),
    dryRun = data.demo || sandbox;
  if (data.demo) {
    if (!s.demoEnabled || s.salesEnabled)
      throw new ShopError("Modo demonstrativo indisponível.", 409);
  } else if (!sandbox && (!s.salesEnabled || launchIssues(s).length))
    throw new ShopError(
      "A loja está em pré-lançamento. Novas vendas serão liberadas após a configuração.",
      409,
    );
  const { items, subtotal, quantities } = await cartItems(data.items),
    discount = await getDiscount(data.coupon, subtotal);
  const shipping = shippingQuotes(
    s,
    data.address.state,
    subtotal - discount.amount,
    dryRun,
  ).find((r) => r.id === data.shippingId);
  if (!shipping)
    throw new ShopError(
      "Escolha uma opção de entrega disponível para o seu endereço.",
    );
  const id = uid(),
    number = `SM${new Date().getFullYear()}-${uid().replaceAll("-", "").slice(0, 8).toUpperCase()}`,
    stamp = now();
  const total = subtotal - discount.amount + shipping.amount;
  const paymentConfig = {
    installments: installmentTotals(total, s),
    pixMinutes: s.pixMinutes,
    boletoDays: s.boletoDays,
    expiresAt: new Date(Date.now() + s.boletoDays * 86400000).toISOString(),
  };
  const checks = Array.from(quantities, ([productId, qty]) => ({
    productId,
    qty,
    p: items.find((p) => p.productId === productId)!,
  }));
  const conditions = checks
    .map(
      () =>
        `EXISTS (SELECT 1 FROM products WHERE id=? AND active=1 AND price=? AND pieces=? ${dryRun ? "" : "AND stock>=?"})`,
    )
    .join(" AND ");
  const binds = checks.flatMap((x) => [
    x.productId,
    x.p.price,
    x.p.pieces,
    ...(dryRun ? [] : [x.qty]),
  ]);
  const couponCondition =
    discount.code && !dryRun
      ? " AND EXISTS (SELECT 1 FROM coupons WHERE code=? AND kind=? AND value=? AND minimum=? AND active=1 AND used<usage_limit AND (expires_at IS NULL OR expires_at>?))"
      : "";
  const statements = [
    database
      .prepare(
        `INSERT INTO orders (id,number,owner_key,user_id,request_key,items,customer,address,shipping,subtotal,discount,total,coupon_code,payment_method,payment_status,fulfillment,demo,reserved,provider_environment,created_at,updated_at,payment_config) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'new',?,?,?,?,?,? WHERE ${conditions}${couponCondition}`,
      )
      .bind(
        id,
        number,
        who.key,
        who.userId,
        data.requestKey,
        JSON.stringify(items),
        JSON.stringify(data.customer),
        JSON.stringify(data.address),
        JSON.stringify(shipping),
        subtotal,
        discount.amount,
        total,
        discount.code,
        data.paymentMethod,
        data.demo ? "pending" : "creating",
        data.demo ? 1 : 0,
        dryRun ? 0 : 1,
        paymentEnvironment(),
        stamp,
        stamp,
        JSON.stringify(paymentConfig),
        ...binds,
        ...(discount.code && !dryRun
          ? [
              discount.code,
              discount.snapshot!.kind,
              discount.snapshot!.value,
              discount.snapshot!.minimum,
              stamp,
            ]
          : []),
      ),
    ...(!dryRun
      ? checks.map((x) =>
          database
            .prepare(
              "UPDATE products SET stock=stock-?,updated_at=? WHERE id=? AND EXISTS (SELECT 1 FROM orders WHERE id=?)",
            )
            .bind(x.qty, stamp, x.productId, id),
        )
      : []),
    ...(discount.code && !dryRun
      ? [
          database
            .prepare(
              "UPDATE coupons SET used=used+1 WHERE code=? AND EXISTS (SELECT 1 FROM orders WHERE id=?)",
            )
            .bind(discount.code, id),
        ]
      : []),
  ];
  try {
    const result = await database.batch(statements);
    if (!result[0].meta.changes)
      throw new ShopError(
        "Estoque ou cupom foi atualizado. Revise o carrinho e tente novamente.",
        409,
      );
  } catch (error) {
    const row = await database
      .prepare("SELECT id FROM orders WHERE owner_key=? AND request_key=?")
      .bind(who.key, data.requestKey)
      .first<{ id: string }>();
    if (row)
      return { order: await getOrder(row.id, request), cookie: who.cookie };
    throw error;
  }
  await event(
    id,
    "order.created",
    data.demo
      ? "Pedido demonstrativo criado. Nenhuma cobrança ou baixa de estoque."
      : sandbox
        ? "Pedido de teste Pagar.me criado. Nenhuma baixa de estoque real."
        : "Pedido recebido e estoque reservado.",
  );
  // Read directly: the guest cookie does not exist on the incoming request yet.
  const raw = await database
    .prepare("SELECT * FROM orders WHERE id=?")
    .bind(id)
    .first<Record<string, unknown>>();
  const { decodeOrder } = await import("./server");
  const order = decodeOrder(raw!);
  if (!data.demo) {
    try {
      order.payment_link = await createPaymentLink(
        order,
        new URL(request.url).origin,
      );
      order.payment_status = "pending";
    } catch (error) {
      await event(
        id,
        "payment.error",
        error instanceof ShopError ? error.message : "Pagamento indisponível.",
      );
    }
  }
  return { order, cookie: who.cookie };
}
