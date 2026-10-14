"use client";
import { usePathname } from "next/navigation";
import { Header, Footer, CartDrawer } from "./shell";
import { Home } from "./home";
import { Catalog, ProductPage } from "./catalog";
import { CartPage } from "./cart";
import { CheckoutPage } from "./checkout";
import { AccountPage, OrderPage } from "./account";
import { AdminPage } from "./admin";
import { AboutPage, WholesalePage, ContactPage, PolicyPage } from "./info";
import { useShop } from "./context";
import { ErrorBox, Button } from "./ui";
export default function Storefront() {
  const path = usePathname(),
    { error, refresh } = useShop();
  if (path.startsWith("/admin")) return <AdminPage />;
  const segments = path.split("/").filter(Boolean);
  let page: React.ReactNode;
  if (path === "/") page = <Home />;
  else if (path === "/camisetas") page = <Catalog />;
  else if (path === "/carrinho") page = <CartPage />;
  else if (path === "/checkout") page = <CheckoutPage />;
  else if (path === "/minha-conta") page = <AccountPage />;
  else if (path === "/sobre") page = <AboutPage />;
  else if (path === "/atacado") page = <WholesalePage />;
  else if (path === "/contato") page = <ContactPage />;
  else if (segments[0] === "produto") page = <ProductPage slug={segments[1]} />;
  else if (segments[0] === "pedido") page = <OrderPage id={segments[1]} />;
  else if (segments[0] === "politicas")
    page = <PolicyPage slug={segments[1]} />;
  return (
    <>
      <Header />
      {error && (
        <div className="container connectivity-notice">
          <ErrorBox message="Não conseguimos carregar os dados atualizados da loja. Tente novamente para continuar." />
          <Button variant="outline" onClick={refresh}>
            Tentar novamente
          </Button>
        </div>
      )}
      <main id="conteudo">{page}</main>
      <Footer />
      <CartDrawer />
    </>
  );
}
