export type Product = {
  id: string;
  slug: string;
  title: string;
  pieces: number;
  price: number;
  stock: number;
  active: number;
  featured: number;
  description: string;
  image: string;
  specs: Record<string, string>;
  updated_at?: string;
};
export type Grade = { P: number; M: number; G: number; GG: number };
export type CartItem = { productId: string; quantity: number; grade: Grade };
export type ShippingRule = {
  toArrange?: boolean;
  id: string;
  label: string;
  states: string[];
  amount: number;
  freeAbove: number;
  minDays: number;
  maxDays: number;
  active: boolean;
};
export type StoreSettings = {
  storeName: string;
  legalName: string;
  cnpj: string;
  fiscalEmail: string;
  phone: string;
  email: string;
  whatsapp: string;
  originZip: string;
  address: string;
  businessHours: string;
  about: string;
  shippingPolicy: string;
  returnPolicy: string;
  privacyPolicy: string;
  terms: string;
  demoEnabled: boolean;
  salesEnabled: boolean;
  inventoryConfirmed: boolean;
  maxInstallments: number;
  freeInstallments: number;
  installmentInterest: number;
  pixMinutes: number;
  boletoDays: number;
  emailFrom: string;
  shippingRules: ShippingRule[];
  sizeChart: { size: string; width: string; height: string }[];
};
export type OrderItem = CartItem & {
  title: string;
  pieces: number;
  price: number;
  image: string;
};
export type PaymentDetails = { method: string; qrCode?: string; qrCodeUrl?: string; barcode?: string; boletoUrl?: string; expiresAt?: string };
export type PaymentConfig = {
  checkout?: "hosted" | "transparent";
  selectedInstallments?: number;
  installments: { number: number; total: number }[];
  pixMinutes: number;
  boletoDays: number;
  expiresAt: string;
};
export type Order = {
  payment_details?: PaymentDetails;
  id: string;
  number: string;
  items: OrderItem[];
  customer: Customer;
  address: Address;
  shipping: ShippingQuote;
  subtotal: number;
  discount: number;
  total: number;
  coupon_code?: string;
  payment_method: string;
  payment_status: string;
  fulfillment: string;
  payment_link?: string;
  sandbox?: boolean;
  payment_config?: PaymentConfig;
  charged_total?: number;
  demo: number;
  tracking_code?: string;
  carrier?: string;
  invoice_url?: string;
  created_at: string;
  updated_at: string;
  events?: { id: string; type: string; note: string; created_at: string }[];
};
export type Customer = {
  type: "individual" | "company";
  name: string;
  document: string;
  email: string;
  phone: string;
  marketing: boolean;
};
export type Address = {
  zip: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
};
export type ShippingQuote = {
  toArrange?: boolean;
  id: string;
  label: string;
  amount: number;
  minDays: number;
  maxDays: number;
  demo?: boolean;
};
export type Bootstrap = {
  transparentCheckout?: boolean;
  pagarmePublicKey?: string;
  products: Product[];
  settings: StoreSettings;
  user: { userId: string; email: string; displayName: string } | null;
  admin: boolean;
  paymentReady: boolean;
  paymentEnvironment: string;
  emailReady: boolean;
  launchIssues: string[];
  sandbox?: boolean;
  demo: boolean;
};
export const money = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    n / 100,
  );
export const date = (s: string) =>
  new Date(s).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
export const emptyGrade = (): Grade => ({ P: 0, M: 0, G: 0, GG: 0 });
export function balancedGrade(pieces: number): Grade {
  const base = Math.floor(pieces / 4);
  return { P: base, M: base, G: base, GG: pieces - base * 3 };
}
export const paymentLabels: Record<string, string> = {
  pending: "Aguardando pagamento",
  paid: "Pagamento aprovado",
  failed: "Pagamento recusado",
  canceled: "Cancelado",
  refunded: "Estornado",
  disputed: "Em contestação",
  creating: "Preparando pagamento",
  review: "Aguardando conferência",
};
export const fulfillmentLabels: Record<string, string> = {
  new: "Pedido recebido",
  processing: "Em separação",
  shipped: "Em transporte",
  delivered: "Entregue",
  canceled: "Cancelado",
};
