import { z } from "zod";
import { after } from "next/server";
import { env } from "@/lib/env";
import { getStoreUser } from "@/lib/auth/user";
import {
  seed,
  db,
  getSettings,
  getProducts,
  isAdmin,
  requireAdmin,
  launchIssues,
  owner,
  getOrder,
  decodeOrder,
  cartItems,
  getDiscount,
  shippingQuotes,
  rateLimit,
  assertSameOrigin,
  jsonBody,
  ShopError,
  event,
  uid,
  now,
  paymentEnvironment,
  sandboxEnabled,
  claimGuestOrders,
} from "@/lib/shop/server";
import {
  settingsSchema,
  productSchema,
  couponSchema,
  addressSchema,
  customerSchema,
  digits,
  states,
} from "@/lib/shop/validation";
import { checkout } from "@/lib/shop/checkout";
import {
  createPaymentLink,
  syncOrder,
  sendOrderEmail,
  cancelUnpaidOrder,
  reconcileExpiredOrders,
} from "@/lib/shop/payments";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

async function handle(request: Request) {
  try {
    assertSameOrigin(request);
    await seed();
    const path = new URL(request.url).pathname.replace(/^\/api\/shop\/?/, "");
    const method = request.method;
    let data: any;
    let cookie: string | null = null;
    if (method === "GET" && path === "bootstrap") {
      if (env.PAGARME_SECRET_KEY) after(async () => {
        try { await reconcileExpiredOrders(); }
        catch { console.error("Não foi possível reconciliar reservas pendentes."); }
      });
      await claimGuestOrders(request);
      const settings = await getSettings(),
        admin = await isAdmin();
      const { fiscalEmail, ...publicSettings } = settings;
      const who = await owner(request);
      cookie = who.cookie;
      data = {
        products: await getProducts(),
        settings: admin ? settings : { ...publicSettings, fiscalEmail: "" },
        user: await getStoreUser(),
        admin,
        paymentReady: !!env.PAGARME_SECRET_KEY,
        paymentEnvironment: paymentEnvironment(),
        emailReady: !!env.RESEND_API_KEY && !!settings.emailFrom,
        launchIssues: admin ? launchIssues(settings) : [],
        sandbox: sandboxEnabled(settings),
        demo:
          !settings.salesEnabled &&
          settings.demoEnabled &&
          !sandboxEnabled(settings),
      };
    } else if (method === "GET" && path.startsWith("cep/")) {
      await rateLimit(request, "cep", 40);
      const cep = digits(path.slice(4));
      if (cep.length !== 8) throw new ShopError("Informe um CEP de 8 dígitos.");
      let response: Response;
      try {
        response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
          signal: AbortSignal.timeout(7000),
        });
      } catch {
        throw new ShopError(
          "Consulta de CEP indisponível. Preencha o endereço manualmente.",
          502,
        );
      }
      if (!response.ok)
        throw new ShopError("Consulta de CEP indisponível.", 502);
      const a: any = await response.json();
      if (a.erro)
        throw new ShopError(
          "CEP não encontrado. Confira o número ou preencha manualmente.",
        );
      data = {
        street: a.logradouro,
        district: a.bairro,
        city: a.localidade,
        state: a.uf,
      };
    } else if (method === "POST" && path === "quote") {
      const input = await jsonBody(request);
      const { subtotal } = await cartItems(input.items);
      const discount = await getDiscount(String(input.coupon || ""), subtotal);
      const s = await getSettings();
      if (input.state && !states.includes(input.state))
        throw new ShopError("Estado inválido.");
      data = {
        subtotal,
        discount: discount.amount,
        coupon: discount.code,
        shipping: input.state
          ? shippingQuotes(
              s,
              input.state,
              subtotal - discount.amount,
              !s.salesEnabled && s.demoEnabled,
            )
          : [],
      };
    } else if (method === "POST" && path === "checkout") {
      await rateLimit(request, "checkout", 10);
      const result = await checkout(request, await jsonBody(request));
      data = result.order;
      cookie = result.cookie;
    } else if (method === "GET" && path === "orders") {
      const who = await owner(request);
      const rows = await db()
        .prepare(
          "SELECT * FROM orders WHERE owner_key=? ORDER BY created_at DESC LIMIT 100",
        )
        .bind(who.key)
        .all<Record<string, unknown>>();
      data = rows.results.map(decodeOrder);
    } else if (/^orders\/[^/]+$/.test(path) && method === "GET")
      data = await getOrder(path.split("/")[1], request, await isAdmin());
    else if (/^orders\/[^/]+\/sync$/.test(path) && method === "POST") {
      await rateLimit(request, "sync", 20);
      const id = path.split("/")[1];
      await getOrder(id, request);
      await syncOrder(id);
      data = await getOrder(id, request);
    } else if (/^orders\/[^/]+\/payment$/.test(path) && method === "POST") {
      await rateLimit(request, "payment", 6);
      const order = await getOrder(path.split("/")[1], request);
      data = {
        url: await createPaymentLink(order, new URL(request.url).origin),
      };
    } else if (/^orders\/[^/]+\/cancel$/.test(path) && method === "POST") {
      await rateLimit(request, "cancel", 6);
      const id = path.split("/")[1];
      await getOrder(id, request);
      await cancelUnpaidOrder(id, new URL(request.url).origin);
      data = await getOrder(id, request);
    } else if (path === "profile") {
      const user = await getStoreUser();
      if (!user)
        throw new ShopError("Entre na sua conta para salvar seus dados.", 401);
      if (method === "GET") {
        const row = await db()
          .prepare("SELECT data FROM profiles WHERE user_id=?")
          .bind(user.userId)
          .first<{ data: string }>();
        data = row ? JSON.parse(row.data) : null;
      } else if (method === "POST") {
        const body = await jsonBody(request),
          profile = {
            customer: customerSchema.parse(body.customer),
            address: addressSchema.parse(body.address),
          };
        await db()
          .prepare(
            "INSERT INTO profiles (user_id,data,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",
          )
          .bind(user.userId, JSON.stringify(profile), now())
          .run();
        data = profile;
      } else throw new ShopError("Método não permitido.", 405);
    } else if (method === "POST" && path === "contact") {
      await rateLimit(request, "contact", 5);
      const body = z
        .object({
          name: z.string().trim().min(3).max(100),
          email: z.string().email().max(150),
          message: z.string().trim().min(10).max(4000),
          website: z.string().max(0).optional(),
        })
        .strict()
        .parse(await jsonBody(request));
      await db()
        .prepare(
          "INSERT INTO contacts (id,name,email,message,status,created_at) VALUES (?,?,?,?,?,?)",
        )
        .bind(uid(), body.name, body.email, body.message, "new", now())
        .run();
      data = { ok: true };
    } else if (method === "POST" && path === "newsletter") {
      await rateLimit(request, "newsletter", 5);
      const body = z
        .object({
          email: z.string().email().max(150),
          consent: z.literal(true),
        })
        .strict()
        .parse(await jsonBody(request));
      await db()
        .prepare(
          "INSERT INTO newsletter (email,active,created_at) VALUES (?,1,?) ON CONFLICT(email) DO UPDATE SET active=1",
        )
        .bind(body.email.toLowerCase(), now())
        .run();
      data = { ok: true };
    } else if (path.startsWith("admin")) {
      await requireAdmin();
      if (method === "GET" && path === "admin/dashboard") {
        const [products, orders, coupons, contacts, subscribers] =
          await Promise.all([
            getProducts(true),
            db()
              .prepare(
                "SELECT * FROM orders ORDER BY created_at DESC LIMIT 500",
              )
              .all<Record<string, unknown>>(),
            db().prepare("SELECT * FROM coupons ORDER BY code").all(),
            db()
              .prepare(
                "SELECT * FROM contacts ORDER BY created_at DESC LIMIT 200",
              )
              .all(),
            db()
              .prepare(
                "SELECT email,created_at,active FROM newsletter ORDER BY created_at DESC LIMIT 500",
              )
              .all(),
          ]);
        data = {
          products,
          orders: orders.results.map(decodeOrder),
          coupons: coupons.results,
          contacts: contacts.results,
          subscribers: subscribers.results,
          settings: await getSettings(),
        };
      } else if (method === "POST" && path === "admin/settings") {
        const s = settingsSchema.parse(await jsonBody(request));
        if (s.salesEnabled) {
          const issues = launchIssues(s);
          if (issues.length)
            throw new ShopError(
              `Antes de ativar as vendas: ${issues.join("; ")}.`,
            );
        }
        await db()
          .prepare("UPDATE settings SET data=? WHERE key='store'")
          .bind(JSON.stringify(s))
          .run();
        data = s;
      } else if (method === "POST" && path === "admin/products") {
        const p = productSchema.parse(await jsonBody(request));
        await db()
          .prepare(
            "INSERT INTO products (id,slug,title,pieces,price,stock,active,featured,description,image,specs,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,pieces=excluded.pieces,price=excluded.price,stock=excluded.stock,active=excluded.active,featured=excluded.featured,description=excluded.description,image=excluded.image,specs=excluded.specs,updated_at=excluded.updated_at",
          )
          .bind(
            p.id,
            p.slug,
            p.title,
            p.pieces,
            p.price,
            p.stock,
            p.active,
            p.featured,
            p.description,
            p.image,
            JSON.stringify(p.specs),
            now(),
          )
          .run();
        data = p;
      } else if (method === "POST" && path === "admin/coupons") {
        const c = couponSchema.parse(await jsonBody(request));
        await db()
          .prepare(
            "INSERT INTO coupons (code,kind,value,minimum,usage_limit,used,active,expires_at) VALUES (?,?,?,?,?,0,?,?) ON CONFLICT(code) DO UPDATE SET kind=excluded.kind,value=excluded.value,minimum=excluded.minimum,usage_limit=excluded.usage_limit,active=excluded.active,expires_at=excluded.expires_at",
          )
          .bind(
            c.code,
            c.kind,
            c.value,
            c.minimum,
            c.usage_limit,
            c.active,
            c.expires_at,
          )
          .run();
        data = c;
      } else if (/^admin\/orders\/[^/]+$/.test(path) && method === "GET")
        data = await getOrder(path.split("/")[2], request, true);
      else if (/^admin\/orders\/[^/]+\/sync$/.test(path) && method === "POST") {
        const id = path.split("/")[2];
        await syncOrder(id);
        data = await getOrder(id, request, true);
      } else if (
        /^admin\/orders\/[^/]+\/cancel$/.test(path) &&
        method === "POST"
      ) {
        const id = path.split("/")[2];
        await cancelUnpaidOrder(id, new URL(request.url).origin);
        data = await getOrder(id, request, true);
      } else if (/^admin\/orders\/[^/]+$/.test(path) && method === "POST") {
        const id = path.split("/")[2];
        const order = await getOrder(id, request, true);
        const body = z
          .object({
            fulfillment: z.enum(["new", "processing", "shipped", "delivered"]),
            tracking_code: z.string().max(100),
            carrier: z.string().max(100),
            invoice_url: z
              .string()
              .max(1500)
              .refine((s) => !s || /^https:\/\//.test(s)),
          })
          .strict()
          .parse(await jsonBody(request));
        if (
          order.payment_status !== "paid" &&
          !order.demo &&
          body.fulfillment !== "new"
        )
          throw new ShopError(
            "O pedido deve ter pagamento aprovado antes de seguir para separação.",
          );
        if (
          body.fulfillment === "shipped" &&
          (!body.tracking_code || !body.carrier)
        )
          throw new ShopError("Informe transportadora e código de rastreio.");
        await db()
          .prepare(
            "UPDATE orders SET fulfillment=?,tracking_code=?,carrier=?,invoice_url=?,updated_at=? WHERE id=?",
          )
          .bind(
            body.fulfillment,
            body.tracking_code,
            body.carrier,
            body.invoice_url,
            now(),
            id,
          )
          .run();
        await event(
          id,
          "fulfillment.updated",
          `Pedido atualizado: ${body.fulfillment}.`,
        );
        data = await getOrder(id, request, true);
        if (body.fulfillment === "shipped" && order.fulfillment !== "shipped")
          await sendOrderEmail(data, "Pedido enviado");
      } else if (
        /^admin\/orders\/[^/]+\/demo-payment$/.test(path) &&
        method === "POST"
      ) {
        const id = path.split("/")[2];
        const o = await getOrder(id, request, true);
        if (!o.demo)
          throw new ShopError(
            "Simulação permitida apenas para pedidos demonstrativos.",
          );
        const b = z
          .object({ status: z.enum(["pending", "paid", "failed", "refunded"]) })
          .parse(await jsonBody(request));
        await db()
          .prepare(
            "UPDATE orders SET payment_status=?,updated_at=? WHERE id=? AND demo=1",
          )
          .bind(b.status, now(), id)
          .run();
        await event(
          id,
          "demo.payment",
          `Simulação de pagamento: ${b.status}. Nenhuma transação financeira.`,
        );
        data = await getOrder(id, request, true);
      } else if (/^admin\/contacts\/[^/]+$/.test(path) && method === "POST") {
        const b = z
          .object({ status: z.enum(["new", "resolved"]) })
          .parse(await jsonBody(request));
        await db()
          .prepare("UPDATE contacts SET status=? WHERE id=?")
          .bind(b.status, path.split("/")[2])
          .run();
        data = { ok: true };
      } else throw new ShopError("Rota administrativa não encontrada.", 404);
    } else throw new ShopError("Recurso não encontrado.", 404);
    return Response.json(data, {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...(cookie ? { "Set-Cookie": cookie } : {}),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return Response.json(
        {
          error: error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join(" "),
        },
        { status: 400 },
      );
    if (error instanceof ShopError)
      return Response.json({ error: error.message }, { status: error.status });
    console.error(
      "Shop request failed",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json(
      { error: "Não foi possível concluir. Tente novamente em instantes." },
      { status: 500 },
    );
  }
}
export const GET = handle;
export const POST = handle;
