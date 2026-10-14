export async function tokenizeCard(form: HTMLFormElement, publicKey?: string) {
  if (!publicKey || !/^pk_[A-Za-z0-9]+$/.test(publicKey)) throw new Error("O cartão está temporariamente indisponível. Escolha Pix ou boleto.");
  const value = (key: string) => form.querySelector<HTMLInputElement>(`[data-card-field="${key}"]`)?.value.trim() || "";
  const number = value("number").replace(/\D/g, ""), cvv = value("cvv"), holder_name = value("holder_name");
  const expiry = value("expiry").match(/^(\d{2})\/(\d{2}|\d{4})$/);
  if (!/^\d{13,19}$/.test(number) || !/^\d{3,4}$/.test(cvv) || !holder_name || !expiry) throw new Error("Confira o número, nome, validade e código de segurança do cartão.");
  const exp_month = Number(expiry[1]), exp_year = Number(expiry[2]) + (expiry[2].length === 2 ? 2000 : 0);
  if (exp_month < 1 || exp_month > 12 || new Date(exp_year, exp_month, 1) <= new Date()) throw new Error("Confira a validade do cartão.");
  let response: Response;
  try {
    response = await fetch(`https://api.pagar.me/core/v5/tokens?appId=${encodeURIComponent(publicKey)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "card", card: { number, holder_name, exp_month, exp_year, cvv } }),
      signal: AbortSignal.timeout(15000),
    });
  } catch { throw new Error("Não foi possível proteger os dados do cartão. Tente novamente ou escolha outra forma de pagamento."); }
  const token = await response.json().catch(() => ({}));
  if (!response.ok || !/^token_[A-Za-z0-9]+$/.test(token.id || "")) throw new Error("O Pagar.me não conseguiu validar o cartão. Confira os dados ou escolha outra forma de pagamento.");
  form.querySelectorAll<HTMLInputElement>("[data-card-field]").forEach(input => { input.value = ""; });
  return token.id as string;
}
