"use client";
import { createBrowserClient } from "@supabase/ssr";
import { authConfig } from "./config";

export function browserAuth() {
  const config = authConfig();
  if (!config) throw new Error("O acesso à conta está temporariamente indisponível. Tente novamente em instantes.");
  return createBrowserClient(config.url, config.key);
}
