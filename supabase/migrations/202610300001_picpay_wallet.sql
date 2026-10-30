-- Preserve existing Pagar.me orders and allow the new PicPay wallet method.
-- No credentials, financial data or existing payment states are changed.
BEGIN;
ALTER TABLE supermalhas.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE supermalhas.orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('pix', 'credit_card', 'boleto', 'wallet'));
-- Update only the provider references in the current store policies. Preserve
-- freight terms, contact details and all other merchant-authored settings.
UPDATE supermalhas.settings
SET data = jsonb_set(data, '{privacyPolicy}', to_jsonb(replace(data->>'privacyPolicy', 'Pagar.me', 'PicPay')))
WHERE key='store' AND jsonb_typeof(data->'privacyPolicy')='string';
UPDATE supermalhas.settings
SET data = jsonb_set(data, '{terms}', to_jsonb(replace(replace(replace(
  data->>'terms', 'Pagar.me', 'PicPay'), 'Pix, boleto e cartão', 'Pix, carteira PicPay e cartão'),
  'Para Pix e boleto, respeite os vencimentos exibidos.', 'Para Pix e carteira PicPay, respeite os vencimentos exibidos.')))
WHERE key='store' AND jsonb_typeof(data->'terms')='string';
COMMIT;
