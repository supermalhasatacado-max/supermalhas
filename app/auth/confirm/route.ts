import { NextResponse } from "next/server";
import { serverAuth } from "@/lib/auth/server";
import { safeReturnPath } from "@/lib/auth/config";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get("token_hash"), type = url.searchParams.get("type");
  const client = await serverAuth();
  if (client && token_hash && (type === "email" || type === "signup" || type === "recovery")) {
    const { error } = await client.auth.verifyOtp({ token_hash, type });
    if (!error) return NextResponse.redirect(new URL(type === "recovery" ? "/entrar/nova-senha" : safeReturnPath(url.searchParams.get("return_to")), url.origin));
  }
  return NextResponse.redirect(new URL("/entrar?error=link", url.origin));
}
