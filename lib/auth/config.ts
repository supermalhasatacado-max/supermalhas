export function authConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !/^[a-z0-9-]+\.supabase\.co$/.test(parsed.hostname) ||
    parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.username || parsed.password ||
    key.startsWith("sb_secret_")) throw new Error("Configuração pública do Supabase inválida.");
  // Never let a service_role JWT reach the client.
  if (key.split(".").length === 3) {
    try {
      const payload = JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (payload.role !== "anon") throw new Error("A chave pública deve ter o papel anon.");
    } catch { throw new Error("Chave pública do Supabase inválida."); }
  } else if (!key.startsWith("sb_publishable_")) throw new Error("Chave pública do Supabase inválida.");
  return { url: parsed.origin, key };
}

export function safeReturnPath(value: string | null | undefined, fallback = "/minha-conta") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return fallback;
  try {
    const url = new URL(value, "https://store.local");
    if (url.origin !== "https://store.local" || /^\/(?:auth|entrar)(?:\/|$)/.test(url.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}
