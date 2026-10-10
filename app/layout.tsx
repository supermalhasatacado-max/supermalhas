import type { Metadata } from "next";
import "./globals.css";
import { ShopProvider } from "@/components/shop/context";
import { getSettings } from "@/lib/shop/server";
import { defaultSettings } from "@/lib/shop/defaults";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings().catch(() => defaultSettings);
  return {
    title: {
      default: `${settings.storeName} | Qualidade que veste seu negócio`,
      template: `%s | ${settings.storeName}`,
    },
    description:
      "Camisetas brancas em malha peruana no atacado. Pacotes de 200, 300 e 400 peças para revenda, uniformes e personalização.",
    robots: { index: settings.salesEnabled, follow: settings.salesEnabled },
    metadataBase: new URL(
      "https://super-malhas-atacado.loucassio.chatgpt.site",
    ),
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: settings.storeName,
      images: [
        {
          url: "/images/hero.png",
          width: 1536,
          height: 1024,
          alt: "Super Malhas Atacado",
        },
      ],
    },
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <ShopProvider>{children}</ShopProvider>
      </body>
    </html>
  );
}
