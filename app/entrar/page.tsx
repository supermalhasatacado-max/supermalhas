import { AuthPage } from "@/components/shop/auth";
export const metadata = { title: "Entre na sua conta", robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ return_to?: string; error?: string }> }) {
  const params = await searchParams;
  return <AuthPage returnTo={params.return_to} initialError={params.error === "link" ? "Esse link expirou ou já foi utilizado. Entre na conta ou solicite um novo link de recuperação." : ""} />;
}
