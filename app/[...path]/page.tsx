import { notFound } from "next/navigation";
import Storefront from "@/components/shop/storefront";
import type { Metadata } from "next";
import { getProducts } from "@/lib/shop/server";
import { defaultProducts } from "@/lib/shop/defaults";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ path: string[] }>;
}): Promise<Metadata> {
  const { path } = await params;
  if (
    ["admin", "pedido", "checkout", "minha-conta", "carrinho"].includes(path[0])
  )
    return {
      title: path[0] === "admin" ? "Administração" : "Sua compra",
      robots: { index: false, follow: false },
    };
  if (path[0] === "produto") {
    const products = await getProducts().catch(() => defaultProducts);
    const p = products.find((p) => p.slug === path[1]);
    if (p)
      return {
        title: p.title,
        description: p.description,
        openGraph: {
          title: p.title,
          description: p.description,
          images: [{ url: p.image, alt: p.title }],
        },
      };
  }
  const titles: Record<string, string> = {
    camisetas: "Camisetas no atacado",
    sobre: "Sobre a Super Malhas",
    atacado: "Comprar no atacado",
    contato: "Central de atendimento",
    politicas: "Políticas da loja",
  };
  return { title: titles[path[0]] || "Super Malhas" };
}
export default async function Page({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  const singles = [
    "camisetas",
    "carrinho",
    "checkout",
    "minha-conta",
    "sobre",
    "atacado",
    "contato",
    "admin",
  ];
  const nested = ["produto", "pedido", "politicas", "admin"];
  if (
    (path.length === 1 && !singles.includes(path[0])) ||
    (path.length === 2 && !nested.includes(path[0])) ||
    path.length > 2
  )
    notFound();
  if (
    path[0] === "politicas" &&
    !["entrega", "trocas", "privacidade", "termos"].includes(path[1])
  )
    notFound();
  if (
    path[0] === "admin" &&
    path[1] &&
    ![
      "pedidos",
      "produtos",
      "cupons",
      "empresa",
      "entrega",
      "politicas",
      "pagamentos",
      "mensagens",
      "lancamento",
    ].includes(path[1])
  )
    notFound();
  return <Storefront />;
}
