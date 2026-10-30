type Result = Record<string, unknown>;
type PicpaySdk = {
  setCredentials(value: { merchantCredential: string; transparentToken: string }): void;
  getCardBrand(value: { bin: string; success: (body: Result) => void; error: (body: unknown) => void }): void;
  createTemporaryCard(value: { card: Record<string, string>; success: (body: Result) => void; error: (body: unknown) => void }): void;
};
declare global { interface Window { CheckoutTransparent?: PicpaySdk } }
let loading: Promise<PicpaySdk> | undefined;
const SDK_URL = "https://checkout.picpay.com/cdn/pp-transparent-v1.0.0.js";
function sdk() {
  if (window.CheckoutTransparent) return Promise.resolve(window.CheckoutTransparent);
  if (loading) return loading;
  loading = new Promise<PicpaySdk>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_URL; script.async = true;
    const timer = setTimeout(() => { script.remove(); reject(new Error("Não foi possível carregar o pagamento por cartão. Escolha Pix ou tente novamente.")); }, 15000);
    script.onload = () => { clearTimeout(timer); window.CheckoutTransparent ? resolve(window.CheckoutTransparent) : reject(new Error("Pagamento por cartão indisponível.")); };
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error("Não foi possível carregar o pagamento por cartão. Escolha Pix ou tente novamente.")); };
    document.head.appendChild(script);
  }).catch(error => { loading = undefined; throw error; });
  return loading;
}
function call(run: (success: (body: Result) => void, error: () => void) => void) {
  return new Promise<Result>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("O PicPay demorou para validar o cartão. Tente novamente.")), 20000);
    const fail = () => { clearTimeout(timer); reject(new Error("O PicPay não conseguiu validar o cartão. Confira os dados ou escolha Pix.")); };
    try { run(body => { clearTimeout(timer); resolve(body); }, fail); } catch { fail(); }
  });
}
export async function tokenizeCard(form: HTMLFormElement, merchantCnpj?: string, transparentToken?: string) {
  if (!/^\d{14}$/.test(merchantCnpj || "") || !transparentToken?.trim())
    throw new Error("O cartão está temporariamente indisponível. Escolha Pix ou carteira PicPay.");
  const value = (key: string) => form.querySelector<HTMLInputElement>(`[data-card-field="${key}"]`)?.value.trim() || "";
  const number = value("number").replace(/\D/g, ""), cvv = value("cvv"), holderName = value("holder_name"), holderDocument = value("holder_document").replace(/\D/g, "");
  const expiry = value("expiry").match(/^(\d{2})\/(\d{2}|\d{4})$/);
  if (!/^\d{13,19}$/.test(number) || !/^\d{3,4}$/.test(cvv) || !holderName || !/^(?:\d{11}|\d{14})$/.test(holderDocument) || !expiry)
    throw new Error("Confira o número, nome, documento do titular, validade e código de segurança do cartão.");
  const month = Number(expiry[1]), year = Number(expiry[2]) + (expiry[2].length === 2 ? 2000 : 0);
  if (month < 1 || month > 12 || new Date(year, month, 1) <= new Date()) throw new Error("Confira a validade do cartão.");
  const provider = await sdk();
  provider.setCredentials({ merchantCredential: merchantCnpj!, transparentToken: transparentToken! });
  try {
    const brand = await call((success, error) => provider.getCardBrand({ bin: number.slice(0, 6), success, error }));
    if (typeof brand.brand !== "string") throw new Error("Bandeira de cartão não identificada.");
    const token = await call((success, error) => provider.createTemporaryCard({ card: { brand: brand.brand as string, number, holderName, holderDocument,
      expirationMonth: expiry[1], expirationYear: String(year), cvv }, success, error }));
    if (typeof token.temporaryToken !== "string" || !/^card_t\/[A-Za-z0-9.\/_+\-]+$/.test(token.temporaryToken))
      throw new Error("O PicPay não conseguiu validar o cartão. Confira os dados ou escolha Pix.");
    return token.temporaryToken;
  } finally {
    // The provider alone receives PAN/CVV; do not retain them after an attempt.
    form.querySelectorAll<HTMLInputElement>("[data-card-field]").forEach(input => { input.value = ""; });
  }
}
