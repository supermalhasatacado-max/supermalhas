import "server-only";
import { cache } from "react";
import { serverAuth } from "./server";

export type StoreUser = { userId: string; email: string; fullName: string | null; displayName: string; emailVerified: boolean };
export const getStoreUser = cache(async (): Promise<StoreUser | null> => {
  const client = await serverAuth();
  if (!client) return null;
  // getUser verifies the session with Supabase. Request headers and an
  // unverified getSession() result never grant access to orders or administration.
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user || !user.email) return null;
  const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.slice(0, 150) : null;
  return { userId: user.id, email: user.email, fullName, displayName: fullName || user.email, emailVerified: !!user.email_confirmed_at };
});
