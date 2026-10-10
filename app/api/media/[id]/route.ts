import { getProductImage } from "@/lib/shop/storage";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) return new Response(null, { status: 404 });
  try {
    return (await getProductImage(id)) || new Response(null, { status: 404 });
  } catch {
    return Response.json(
      { error: "Imagens temporariamente indisponíveis." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
