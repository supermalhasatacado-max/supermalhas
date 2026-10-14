# Pagar.me: configuração e homologação

## Integração preparada

A loja suporta checkout transparente pela API v5 de pedidos. Pix e boleto são exibidos dentro da loja; o cartão é tokenizado diretamente pelo navegador na API Pagar.me, usando a chave pública. O servidor recebe somente o token temporário, converte-o em `card_id` vinculado ao comprador e cria o pedido, compatível com o fluxo PSP. PAN e CVV não são enviados ao servidor da loja, a logs, eventos ou banco de dados. O checkout hospedado é preservado para pedidos anteriores e como configuração alternativa.

Para ativar o novo fluxo, configure `PAGARME_CHECKOUT_MODE=transparent` e `PAGARME_PUBLIC_KEY=pk_...` da mesma conta na Vercel e republique. `hosted` mantém o fluxo anterior. O modo, as parcelas e os totais ficam congelados no pedido, portanto uma mudança de configuração não troca a modalidade de pedidos existentes. A chave pública pode ser exposta ao navegador; a chave secreta continua exclusiva do servidor. A autorização do domínio deve ser conferida no Pagar.me.

O cliente recebe QR Code/copia e cola do Pix, linha digitável e link de boleto, ou o estado de confirmação do cartão, na própria página. A consulta periódica do pedido confirma o pagamento pela API autenticada. A confirmação por webhook continua recomendada; o recebimento real de notificações ainda depende de cadastro e validação no painel do provedor.

A criação direta também usa uma trava durável por pedido. Uma resposta perdida não autoriza outra cobrança: a loja procura o pedido pelo código antes de prosseguir. Os tokens não são persistidos. Recusas de cartão liberam a reserva de estoque; cancelamentos de cobranças diretas emitidas são encaminhados ao atendimento para conferência no Pagar.me, evitando estornos involuntários de pagamentos recebidos durante um cancelamento.

O servidor transmite o total em centavos, incluindo frete com valor definido e cupom. Na modalidade a combinar, o transporte é explicitamente pago à parte e fica fora do total dos produtos; valor e prazo devem ser combinados com o SAC antes do pagamento. Cada link permite um pedido e uma aprovação. Preços, grade, condições de parcelamento, validade e endereço ficam registrados no pedido. Alterações futuras no painel não modificam condições anteriores.

O endpoint `/paymentlinks` foi observado criando links diferentes para POSTs com a mesma `Idempotency-Key`. A loja aplica uma trava durável própria em `order_events`, compartilhada entre instâncias. Após timeout ou resposta inconclusiva, procura o link pelo nome e código do pedido e confere valor e método antes de associá-lo. Não dispara outro POST nesse caso. Uma rejeição explícita HTTP 400/401/403/404/422 permite nova tentativa. Se a consulta continuar inconclusiva, o pedido requer conferência pelo atendimento; a loja não presume que a criação falhou.

## Variáveis protegidas

| Variável | Finalidade |
| --- | --- |
| `PAGARME_SECRET_KEY` | Chave secreta da conta; apenas no servidor. |
| `PAGARME_ENVIRONMENT` | `test` para sandbox; `production` para cobrança real. |
| `PAGARME_CHECKOUT_MODE` | `transparent` para pagamento na loja; `hosted` para checkout hospedado. |
| `PAGARME_PUBLIC_KEY` | Chave pública `pk_...` da mesma conta, usada exclusivamente para tokenização no navegador. |
| `ADMIN_EMAILS` | Administradores autorizados. |
| `PAGARME_WEBHOOK_SECRET` | Opcional, somente se as notificações incluírem `x-webhook-secret` com o valor configurado. |
| `RESEND_API_KEY` | Opcional, envio de e-mails após pagamento e postagem. |

As bases oficiais utilizadas são `https://sdx-api.pagar.me/core/v5` e `https://api.pagar.me/core/v5`. A chave de teste identifica automaticamente o ambiente se a variável de ambiente estiver ausente. Prefira configurar explicitamente.

## Homologação após receber a chave

1. Configurar a chave de teste e o ambiente `test`, mantendo vendas reais desativadas e testes permitidos.
2. Executar uma compra de teste de cada forma de pagamento no checkout hospedado. Para cartão, seguir os dados de aprovação e recusa oficiais do Pagar.me. Não usar dados financeiros reais no sandbox.
3. Confirmar retorno ao pedido, notificações, aprovação, recusa, duplicidade de notificação, cancelamento e estorno. Conferir o valor final das parcelas na página do provedor.
4. Após homologação, configurar chave e ambiente de produção, revisar o contrato comercial Pagar.me, preencher a operação no painel e conferir a publicação no domínio oficial.
5. Cadastrar o webhook público abaixo no dashboard Pagar.me e validar seu recebimento antes de ativar vendas.

```text
https://supermalhasatacado.com.br/api/webhooks/pagarme
```

Na Vercel, esse endpoint deve permanecer acessível ao Pagar.me; não habilitar proteção de deployment que bloqueie a loja de produção ou o webhook. A consulta autenticada pelo botão de atualização funciona sem depender da notificação.

Eventos tratados: eventos `order.*` com `data.id` e eventos de cobrança com `data.order.id`. Assine aprovação, falha, cancelamento, estorno e contestação. O handler consulta o pedido na API autenticada, valida código local, ambiente, moeda e valores permitidos e só então atualiza a loja. O corpo do webhook nunca é fonte de aprovação. Um retorno do checkout também não confirma pagamento.

Se o serviço ficar indisponível, o pedido é preservado e oferece preparação/continuação do pagamento e atualização de status. Uma tentativa recusada encerra a reserva; o cliente pode iniciar uma nova compra. Reembolsos são realizados no Pagar.me e refletidos na loja após confirmação. Peças já postadas não são restocadas automaticamente.

## Estado de validação

Em 14/10/2026, a chave fornecida autenticou na API de produção. Pix, boleto e cartão foram validados criando links inativos (`is_building: true`), consultando total, método, código e limites e cancelando todos os links. A consulta final confirmou zero sessões de pagamento. Nenhuma cobrança real foi executada.

`npm test` cobre banco, concorrência, reserva, cupons, autenticação, transições de pagamento, recuperação de link após perda de resposta, retentativa após rejeição explícita e webhook. Os testes de webhook verificam rejeição de configuração ausente, autenticação opcional, JSON inválido, tamanho excedido e delegação para consulta autenticada; não provam entrega de notificações reais. `tests/http.mjs` verifica a loja publicada sem criar compras.

Para repetir a verificação real com a chave no ambiente privado, use `npm run test:pagarme` (somente autenticação) ou `npm run test:pagarme -- --drafts` (cria rascunhos inativos e os cancela). Não informe a chave em argumentos de linha de comando, arquivos versionados ou logs.

A chave foi salva como segredo restrito à produção na Vercel, com `PAGARME_ENVIRONMENT=production`, e publicada no deployment `BFZ4y29b7k2j3nCjnex8a3pJaD7z`. O domínio oficial confirmou `paymentReady=true` e ambiente de produção. O responsável optou por testar manualmente em produção e solicitou o início da operação real: vendas habilitadas e modo demonstrativo desativado. A interface pública oferece somente compras reais e respeita estoque; registros anteriores sem cobrança não são apresentados como vendas ao cliente. Ainda pendentes: cadastro e comprovação de entrega do webhook real, aprovação/recusa e demais resultados do teste manual do responsável. As verificações automáticas e os links inativos não comprovam liquidação financeira real.

O cadastro operacional autorizado em 14/10/2026 está em `docs/operacao-20261014.json`. O script `scripts/configure-operation.mjs` aplica SAC, políticas e estoque de pacotes completos a uma loja ainda sem vendas, preservando os demais campos. A regra de frete depende da publicação do código que reconhece `toArrange`; só depois executar com `--include-shipping`. Não reexecutar o ajuste inicial para repor estoque de uma loja que já tenha vendido.

## Referências oficiais

- [Criação de link de pagamento](https://docs.pagar.me/reference/criar-link)
- [Checkout hospedado](https://docs.pagar.me/reference/checkout-response)
- [Consulta de link](https://docs.pagar.me/reference/obter-link)
- [Cancelamento de link](https://docs.pagar.me/reference/cancelar-um-link-de-pagamento)
- [Webhooks](https://docs.pagar.me/docs/webhooks)
- [Exemplo oficial de checkout pontual](https://docs.pagar.me/docs/checkout_pagarme_skill_order)
- [Filtro de pedidos no SDK oficial](https://github.com/pagarme/pagarme-core-api-php/blob/master/src/Controllers/OrdersController.php)
