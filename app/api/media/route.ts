import { env } from "cloudflare:workers";
import {
  requireAdmin,
  rateLimit,
  seed,
  uid,
  ShopError,
} from "@/lib/shop/server";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin)
      throw new ShopError("Origem inválida.", 403);
    await requireAdmin();
    await seed();
    await rateLimit(request, "image-upload", 10);
    if (!env.BUCKET)
      throw new ShopError("Armazenamento de imagens indisponível.", 503);
    const type = request.headers.get("content-type");
    if (!["image/jpeg", "image/png", "image/webp"].includes(type || ""))
      throw new ShopError("Escolha uma imagem JPG, PNG ou WebP.");
    if (Number(request.headers.get("content-length")) > 5 * 1024 * 1024)
      throw new ShopError("A imagem deve ter até 5 MB.", 413);
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.length < 16 || bytes.length > 5 * 1024 * 1024)
      throw new ShopError("A imagem deve ter até 5 MB.", 413);
    const valid =
      type === "image/jpeg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : type === "image/png"
          ? bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10"
          : new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
            new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
    if (!valid)
      throw new ShopError("O arquivo não corresponde ao formato da imagem.");
    const id = uid();
    await env.BUCKET.put(`products/${id}`, bytes, {
      httpMetadata: { contentType: type! },
    });
    return Response.json(
      { url: `/api/media/${id}` },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof ShopError
            ? e.message
            : "Não foi possível enviar a imagem.",
      },
      { status: e instanceof ShopError ? e.status : 500 },
    );
  }
}
