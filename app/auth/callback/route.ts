import { NextResponse } from "next/server";
import { serverAuth } from "@/lib/auth/server";
import { safeReturnPath } from "@/lib/auth/config";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url), code = url.searchParams.get("code");
  const reset = url.searchParams.get("return_to") === "/entrar/nova-senha";
  const destination = reset ? "/entrar/nova-senha" : safeReturnPath(url.searchParams.get("return_to"));
  const client = await serverAuth();
  if (client && code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destination, url.origin));
  }
  return NextResponse.redirect(new URL("/entrar?error=link", url.origin));
}
