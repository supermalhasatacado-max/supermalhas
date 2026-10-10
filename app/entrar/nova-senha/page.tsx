import { AuthPage } from "@/components/shop/auth";
import { getStoreUser } from "@/lib/auth/user";
import { redirect } from "next/navigation";
export const metadata = { title: "Criar nova senha", robots: { index: false, follow: false } };
export default async function Page() {
  if (!(await getStoreUser())) redirect("/entrar?error=link");
  return <AuthPage reset />;
}
