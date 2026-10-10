# Pagar.me: configuração e homologação

## Integração preparada

A loja utiliza a API v5 para criar um checkout hospedado por pedido. Pix, boleto e cartão são selecionados na loja; dados financeiros são preenchidos diretamente na página Pagar.me. Não é necessária uma chave pública para este fluxo e a loja não coleta número de cartão ou CVV.

O servidor transmite o total em centavos, incluindo frete e cupom. Cada link permite um pedido e uma aprovação. Preços, grade, condições de parcelamento, validade e endereço ficam registrados no pedido. Alterações futuras no painel não modificam condições anteriores.

## Variáveis protegidas

| Variável | Finalidade |
| --- | --- |
| `PAGARME_SECRET_KEY` | Chave secreta da conta; apenas no servidor. |
| `PAGARME_ENVIRONMENT` | `test` para sandbox; `production` para cobrança real. |
| `ADMIN_EMAILS` | Administradores autorizados. |
| `PAGARME_WEBHOOK_SECRET` | Opcional, somente se as notificações incluírem `x-webhook-secret` com o valor configurado. |
| `RESEND_API_KEY` | Opcional, envio de e-mails após pagamento e postagem. |

As bases oficiais utilizadas são `https://sdx-api.pagar.me/core/v5` e `https://api.pagar.me/core/v5`. A chave de teste identifica automaticamente o ambiente se a variável de ambiente estiver ausente. Prefira configurar explicitamente.

## Homologação após receber a chave

1. Configurar a chave de teste e o ambiente `test`, mantendo vendas reais desativadas e testes permitidos.
2. Executar uma compra de teste de cada forma de pagamento no checkout hospedado. Para cartão, seguir os dados de aprovação e recusa oficiais do Pagar.me. Não usar dados financeiros reais no sandbox.
3. Confirmar retorno ao pedido, notificações, aprovação, recusa, duplicidade de notificação, cancelamento e estorno. Conferir o valor final das parcelas na página do provedor.
4. Após homologação, configurar chave e ambiente de produção, revisar o contrato comercial Pagar.me, preencher a operação no painel e abrir a audiência da loja para clientes.
5. Cadastrar o webhook público abaixo no dashboard Pagar.me e validar seu recebimento antes de ativar vendas.

```text
https://super-malhas-atacado.loucassio.chatgpt.site/api/webhooks/pagarme
```

Na publicação privada, notificações de terceiros podem ser bloqueadas pela proteção de acesso. A audiência pública é necessária no lançamento para clientes e webhooks. A consulta autenticada pelo botão de atualização funciona sem depender da notificação.

Eventos tratados: eventos `order.*` com `data.id` e eventos de cobrança com `data.order.id`. Assine aprovação, falha, cancelamento, estorno e contestação. O handler consulta o pedido na API autenticada, valida código local, ambiente, moeda e valores permitidos e só então atualiza a loja. O corpo do webhook nunca é fonte de aprovação. Um retorno do checkout também não confirma pagamento.

Se o serviço ficar indisponível, o pedido é preservado e oferece preparação/continuação do pagamento e atualização de status. Uma tentativa recusada encerra a reserva; o cliente pode iniciar uma nova compra. Reembolsos são realizados no Pagar.me e refletidos na loja após confirmação. Peças já postadas não são restocadas automaticamente.

## Estado de validação

Concluídos: TypeScript, build, testes HTTP locais, testes de lógica com SQLite/provedor simulados e compra demonstrativa no navegador em desktop/celular. A homologação com a API real, notificações e dados de teste do Pagar.me permanece pendente da chave. Nenhuma cobrança real foi executada.

## Referências oficiais

- [Criação de link de pagamento](https://docs.pagar.me/reference/criar-link)
- [Checkout hospedado](https://docs.pagar.me/reference/checkout-response)
- [Consulta de link](https://docs.pagar.me/reference/obter-link)
- [Cancelamento de link](https://docs.pagar.me/reference/cancelar-um-link-de-pagamento)
- [Webhooks](https://docs.pagar.me/docs/webhooks)
- [Exemplo oficial de checkout pontual](https://docs.pagar.me/docs/checkout_pagarme_skill_order)
- [Filtro de pedidos no SDK oficial](https://github.com/pagarme/pagarme-core-api-php/blob/master/src/Controllers/OrdersController.php)
