-- Preserve existing Pagar.me orders and allow the new PicPay wallet method.
-- No credentials, financial data or existing payment states are changed.
BEGIN;
ALTER TABLE supermalhas.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE supermalhas.orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('pix', 'credit_card', 'boleto', 'wallet'));
COMMIT;
