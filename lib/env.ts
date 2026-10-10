import "server-only";
import type { StoreDatabase } from "@/db/store-database";

// Legacy bindings are only used by migration fixtures. Vercel reads server
// variables from process.env and always uses Supabase for persistent data.
type RuntimeEnv = Record<string, string | undefined> & {
  DB?: StoreDatabase;
  BUCKET?: {
    put(key: string, body: Uint8Array, options: { httpMetadata: { contentType: string } }): Promise<unknown>;
    get(key: string): Promise<{ body: BodyInit; httpMetadata?: { contentType?: string }; httpEtag: string } | null>;
  };
};
export const env = process.env as RuntimeEnv;

export function siteOrigin() {
  const value = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))))
    throw new Error("SITE_URL inválida.");
  return url.origin;
}
