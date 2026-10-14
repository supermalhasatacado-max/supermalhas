import type { PaymentDetails } from "./types";
function providerUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      ["pagar.me", "stone.com.br"].some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`)) ? url.href : undefined;
  } catch { return undefined; }
}
export function safePaymentDetails(value: unknown): PaymentDetails | undefined {
  if (!value || typeof value !== "object") return;
  const v = value as Record<string, unknown>;
  if (!["pix", "boleto", "credit_card"].includes(String(v.method))) return;
  return {
    method: String(v.method),
    qrCode: typeof v.qrCode === "string" && v.qrCode.length < 12000 ? v.qrCode : undefined,
    qrCodeUrl: providerUrl(v.qrCodeUrl),
    barcode: typeof v.barcode === "string" && v.barcode.length < 200 ? v.barcode : undefined,
    boletoUrl: providerUrl(v.boletoUrl),
    expiresAt: typeof v.expiresAt === "string" && Number.isFinite(Date.parse(v.expiresAt)) ? v.expiresAt : undefined,
  };
}
