# PicPay: configuração e homologação

Novas compras usam o **Gateway PicPay / Checkout API**, com Pix, carteira PicPay e cartão. O cliente paga na loja; cartões são tokenizados pelo SDK oficial diretamente no PicPay. O servidor recebe somente o token temporário, nunca PAN/CVV. Boleto não faz parte desta API e permanece disponível apenas para consultar pedidos antigos.

## Credenciais de configuração

Configure na Vercel, no ambiente correspondente, sem prefixo `NEXT_PUBLIC_`:

| Variável | Finalidade |
| --- | --- |
| `PAYMENT_PROVIDER=picpay` | Provedor de novas compras; também é o padrão quando ausente. |
| `PICPAY_ENVIRONMENT` | `test` para homologação; `production` para cobrança real. |
| `PICPAY_CLIENT_ID` | Identificador da integração **Checkout** no painel PicPay. |
| `PICPAY_CLIENT_SECRET` | Segredo OAuth, exclusivo do servidor. |
| `PICPAY_MERCHANT_CNPJ` | CNPJ da conta PicPay, apenas dígitos. Cadastro informado: `58312831000189`. |
| `PICPAY_TRANSPARENT_TOKEN` | `transparentToken` do SDK, solicitado ao PicPay. Destinado à tokenização no navegador; diferente do segredo OAuth e do token de acesso. |
| `PICPAY_WEBHOOK_TOKEN` | Token gerado ao cadastrar as notificações no painel PicPay. Exclusivo do servidor. |

O cartão só é oferecido após configurar CNPJ e token do SDK. Pix/carteira usam o par OAuth; vendas reais também exigem o token do webhook. A presença de variáveis indica configuração disponível, não comprova autorização comercial nem liquidação de pagamentos.

Os endereços seguem o [módulo oficial PicPay](https://github.com/PicPay/ecommerce-integration-magento2/blob/main/etc/config.xml): produção `https://checkout-api.picpay.com`, sandbox `https://checkout-api-sandbox.picpay.com`; autenticação `/oauth2/token`, operações `/api/v1/charge/...`. O token OAuth é guardado somente na memória do servidor, com renovação antes do vencimento e compartilhamento de renovações concorrentes na mesma instância.

## Banco de dados e publicação

Antes de habilitar a carteira, aplique `supabase/migrations/202610300001_picpay_wallet.sql` no projeto Supabase. A alteração permite o método `wallet` e preserva as compras antigas. O catálogo fechado de 44 operações RPC continua compatível; nenhuma função de SQL arbitrário ou permissão pública foi adicionada.

Publique o código na Vercel após aplicar a migração. Guarde as variáveis antigas `PAGARME_SECRET_KEY`, `PAGARME_ENVIRONMENT` e eventual `PAGARME_WEBHOOK_SECRET` enquanto houver pedidos antigos a conciliar; elas não habilitam silenciosamente novas compras Pagar.me. O provedor e o parcelamento são registrados no `payment_config` de cada novo pedido. Ausência de `provider` em pedidos anteriores significa Pagar.me. Nunca converter a cobrança de um pedido existente para outro gateway.

## Notificações

Cadastre no painel PicPay → Ajustes → Meu checkout → URL de notificação:

```text
https://supermalhasatacado.com.br/api/webhooks/picpay
```

Copie o token gerado para `PICPAY_WEBHOOK_TOKEN`. O cabeçalho `Authorization` deve conter exatamente esse token (não é o token OAuth e não recebe automaticamente o prefixo `Bearer`). O endpoint exige autenticação e aceita eventos `PAYMENT`/`REFUND` com `data.merchantChargeId`. O corpo da notificação nunca aprova a compra: a loja consulta a cobrança pela API e confere referência, valor original, método, parcelas, transações e estornos.

A aprovação exige cobrança e transação `PAID`. Pré-autorização e notificações antigas não aprovam o pedido. Estorno integral libera a reserva uma única vez; estorno parcial exige conferência. Pedidos postados não repõem estoque automaticamente. A consulta autenticada individual também funciona no painel e na página do pedido.

## Falhas, retentativas e cancelamentos

A criação de cobrança usa trava persistente e `merchantChargeId` igual ao UUID local do pedido. Após timeout/erro ambíguo, a loja consulta a mesma referência e não repete automaticamente a cobrança. Uma rejeição explícita de validação/autorização permite corrigir e tentar novamente; recusas financeiras encerram a tentativa e liberam a reserva. Tokens de cartão, OAuth e segredos não são persistidos em pedidos/eventos nem incluídos nas mensagens de erro.

Cancelar no PicPay pode também estornar uma cobrança. Por isso, o cliente solicita cancelamento ao atendimento; a loja só libera a reserva após confirmar expiração/cancelamento pelo provedor. O relógio local não é evidência financeira. O atendimento realiza estornos no painel PicPay e sincroniza o pedido na loja.

## Homologação depois de receber as credenciais

1. Aplicar a migração, configurar as variáveis e republicar. No sandbox, usar credenciais de **Teste Checkout API** e confirmar com o PicPay o `transparentToken` correspondente.
2. Conferir os indicadores no painel → Pagamentos. Habilitar a carteira no Meu checkout da conta PicPay.
3. Com vendas reais desativadas e testes habilitados, testar Pix, carteira e cartão aprovado/recusado, QR Code, parcelas, expiração, consultas e recebimento real de webhook.
4. Conferir estornos integrais/parciais, total em centavos, estoque e ausência de dados financeiros sensíveis nos registros.
5. Configurar o ambiente de produção com as credenciais da conta habilitada e validar uma transação acompanhada pelo responsável antes de liberar a operação.

## Verificação executada

`npm test` mantém os contratos antigos do Pagar.me como regressão e testa PicPay em PostgreSQL/PGlite: OAuth, pagamentos das três modalidades, total, parcelas, timeout, concorrência, reservas, recusa, expiração, estorno, referência/provedor incorretos, notificações forjadas e privacidade de tokens. `npm run test:picpay` executa somente os testes novos. São testes offline com serviços simulados; não comprovam autorização da conta nem entrega de notificações reais. Não há credenciais PicPay configuradas neste momento.

## Fontes oficiais

- [Autenticação](https://developers-business.picpay.com/checkout/docs/authentication)
- [SDK de tokenização](https://developers-business.picpay.com/checkout/docs/transparent-checkout/sdk)
- [Webhooks](https://developers-business.picpay.com/checkout/docs/webhook)
- [Consulta de cobrança](https://developers-business.picpay.com/checkout/docs/api/find-charge)
- [Sandbox](https://developers-business.picpay.com/checkout/docs/sandbox/)
- [Endereços no módulo oficial](https://github.com/PicPay/ecommerce-integration-magento2/blob/main/etc/config.xml)
