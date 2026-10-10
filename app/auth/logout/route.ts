import { NextResponse } from "next/server";
import { serverAuth } from "@/lib/auth/server";
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  if (request.headers.get("origin") !== origin) return Response.json({ error: "Origem inválida." }, { status: 403 });
  const client = await serverAuth();
  if (client) await client.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/", origin), { status: 303 });
}
