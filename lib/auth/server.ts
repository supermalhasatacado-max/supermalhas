import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { authConfig } from "./config";

export async function serverAuth() {
  const config = authConfig();
  if (!config) return null;
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        // Server Components are read-only; proxy refreshes cookies there.
        // Route Handlers can write cookies and must keep the whole refreshed set.
        try { for (const { name, value, options } of values) jar.set(name, value, options); }
        catch { /* Next.js read-only Server Component context. */ }
      },
    },
  });
}
