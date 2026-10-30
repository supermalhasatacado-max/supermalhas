import { paymentProvider } from "./server";
import * as legacy from "./pagarme-transparent-payments";
import { createPicpayPayment } from "./picpay";
import type { Order } from "./types";
export { providerCustomer, transparentOrderPayload } from "./pagarme-transparent-payments";
export function transparentCheckoutEnabled() {
  return paymentProvider() === "picpay" || legacy.transparentCheckoutEnabled();
}
export async function createTransparentPayment(order: Order, token?: string, request?: Request) {
  if (order.payment_config?.provider === "picpay") return createPicpayPayment(order, token, request);
  return legacy.createTransparentPayment(order, token);
}
