import { env } from "@/lib/env";
import { supabaseFetch, usesSupabase } from "@/db/supabase";

const objectPath = (id: string) =>
  `/storage/v1/object/supermalhas-products/products/${id}`;
export async function putProductImage(
  id: string,
  bytes: Uint8Array,
  contentType: string,
) {
  if (usesSupabase()) {
    const response = await supabaseFetch(objectPath(id), {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        "x-upsert": "false",
        "cache-control": "31536000",
      },
      body: new Uint8Array(bytes).buffer,
    });
    if (!response.ok)
      throw new Error(`Supabase Storage recusou o envio (${response.status}).`);
    return;
  }
  if (!env.BUCKET) throw new Error("Armazenamento de imagens indisponível.");
  await env.BUCKET.put(`products/${id}`, bytes, {
    httpMetadata: { contentType },
  });
}

export async function getProductImage(id: string): Promise<Response | null> {
  if (usesSupabase()) {
    const response = await supabaseFetch(objectPath(id));
    if (response.ok)
      return new Response(response.body, {
        headers: {
          "Content-Type":
            response.headers.get("content-type") || "application/octet-stream",
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
          ...(response.headers.get("etag")
            ? { ETag: response.headers.get("etag")! }
            : {}),
        },
      });
    // Existing R2 images keep their original URLs during the migration.
    const missing =
      response.status === 404 ||
      (response.status === 400 &&
        (await response
          .json()
          .then((body) => {
            const error = body as { statusCode?: string; error?: string };
            return error.statusCode === "404" || error.error === "not_found";
          })
          .catch(() => false)));
    if (!missing)
      throw new Error(`Supabase Storage indisponível (${response.status}).`);
  }
  if (!env.BUCKET) return null;
  const object = await env.BUCKET.get(`products/${id}`);
  if (!object) return null;
  return new Response(object.body, {
    headers: {
      "Content-Type":
        object.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      ETag: object.httpEtag,
    },
  });
}
