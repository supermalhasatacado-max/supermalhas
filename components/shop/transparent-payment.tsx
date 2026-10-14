"use client";
import { useEffect, useRef, useState } from "react";
import { Copy, LockKeyhole, RefreshCw } from "lucide-react";
import type { Order } from "@/lib/shop/types";
import { money } from "@/lib/shop/types";
import { tokenizeCard } from "@/lib/shop/tokenize-card";
export { tokenizeCard } from "@/lib/shop/tokenize-card";
import { api, useShop } from "./context";
import { Button, ErrorBox, Field } from "./ui";

export function CardFields() {
  // Intentionally no `name` attributes or React state for PAN/CVV. Only the
  // provider token, never these fields, is sent to the shop's JSON endpoints.
  return <fieldset className="inline-card-fields"><legend>Dados do cartão</legend>
    <Field label="Nome impresso no cartão" required><input data-card-field="holder_name" autoComplete="cc-name" maxLength={64} required /></Field>
    <Field label="Número do cartão" required><input data-card-field="number" inputMode="numeric" autoComplete="cc-number" maxLength={23} required /></Field>
    <div className="form-grid"><Field label="Validade (MM/AAAA)" required><input data-card-field="expiry" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AAAA" maxLength={7} required /></Field>
      <Field label="Código de segurança" required><input data-card-field="cvv" type="password" inputMode="numeric" autoComplete="cc-csc" minLength={3} maxLength={4} required /></Field></div>
    <small><LockKeyhole size={14} /> Dados enviados diretamente ao Pagar.me para proteção do cartão.</small>
  </fieldset>;
}
export function TransparentPaymentPanel({ order, refresh }: { order: Order; refresh: () => void }) {
  const { data, toast } = useShop();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const details = order.payment_details;
  const [generatedQr, setGeneratedQr] = useState({ code: "", image: "" });
  useEffect(() => {
    const code = details?.method === "pix" ? details.qrCode : undefined;
    if (!code) return;
    let active = true;
    import("qrcode").then(module => module.default.toDataURL(code, { width: 240, margin: 2, errorCorrectionLevel: "M" }))
      .then(image => { if (active) setGeneratedQr({ code, image }); }).catch(() => {});
    return () => { active = false; };
  }, [details?.method, details?.qrCode]);
  const qrImage = generatedQr.code === details?.qrCode ? generatedQr.image : !details?.qrCode ? details?.qrCodeUrl : undefined;
  const awaiting = ["creating", "pending"].includes(order.payment_status);
  if (!awaiting) return null;
  const copy = async (value: string) => { try { await navigator.clipboard.writeText(value); toast("Código copiado."); } catch { setError("Copie o código exibido abaixo."); } };
  return <section className="form-panel inline-payment-panel" aria-label="Pagamento do pedido">
    <ErrorBox message={error} />
    {details?.method === "pix" && <><h2>Pague com Pix</h2><p>Escaneie o QR Code no aplicativo do seu banco ou copie o código.</p>
      {qrImage && <img className="pix-qr" src={qrImage} width={240} height={240} alt="QR Code Pix deste pedido" />}
      {details.qrCode && <><textarea readOnly aria-label="Código Pix copia e cola" value={details.qrCode} rows={3} /><Button onClick={() => copy(details.qrCode!)}><Copy size={16} /> Copiar código Pix</Button></>}
    </>}
    {details?.method === "boleto" && <><h2>Seu boleto está disponível</h2><p>O pedido será confirmado após a compensação.</p>
      {details.barcode && <><textarea readOnly aria-label="Linha digitável do boleto" value={details.barcode} rows={2} /><Button onClick={() => copy(details.barcode!)}><Copy size={16} /> Copiar linha digitável</Button></>}
      {details.boletoUrl && <a href={details.boletoUrl} className="btn outline" target="_blank" rel="noopener noreferrer">Abrir ou baixar boleto</a>}
    </>}
    {details?.method === "credit_card" && <><h2>Pagamento em processamento</h2><p>Estamos aguardando a confirmação do Pagar.me. Não é necessário pagar novamente.</p></>}
    {details?.expiresAt && <p>Vencimento: {new Date(details.expiresAt).toLocaleString("pt-BR")}</p>}
    {!details && <form ref={form} onSubmit={async e => {
      e.preventDefault(); if (busy) return; setBusy(true); setError("");
      try { const cardToken = order.payment_method === "credit_card" ? await tokenizeCard(form.current!, data.pagarmePublicKey) : undefined;
        await api(`orders/${order.id}/payment`, cardToken ? { cardToken } : {}); refresh();
      } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    }}><p>Seu pedido foi preservado. Conclua ou confira o pagamento abaixo.</p>{order.payment_method === "credit_card" && <><p>{order.payment_config?.selectedInstallments || 1} parcela(s) · total {money(order.payment_config?.installments.find(p => p.number === order.payment_config?.selectedInstallments)?.total || order.total)}</p><CardFields /></>}<Button type="submit" busy={busy}>Preparar pagamento seguro</Button></form>}
    <Button variant="outline" onClick={refresh}><RefreshCw size={16} /> Já paguei, atualizar</Button>
  </section>;
}
