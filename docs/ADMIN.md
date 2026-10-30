# Guia de gestão da Super Malhas

Entre em `/admin` com sua conta da loja, autenticada pelo Supabase e com e-mail confirmado. O servidor verifica a autorização em todas as operações. A conta do dashboard Supabase não cria automaticamente uma conta de cliente; faça o cadastro pela loja.

## Configurar a operação

1. **Dados da empresa:** revise razão social, CNPJ, telefone, endereço e CEP de origem. Cadastre e-mail de atendimento, WhatsApp e horário. O e-mail fiscal permanece separado do contato público. O nome fantasia cadastral ANABELA BOUTIQUE foi informado pela empresa; a marca comercial desta vitrine é SUPER MALHAS ATACADO.
2. **Produtos e estoque:** informe o estoque disponível em pacotes, preços, descrições, características e fotos. Use o envio de imagem para JPG, PNG ou WebP de até 4 MB. Publique ou oculte produtos e escolha os destaques.
3. **Frete e entrega:** cadastre nome do serviço, estados atendidos, preço, prazo mínimo/máximo e eventual frete grátis por valor. São regras comerciais definidas por você; o cálculo não consulta uma transportadora. Publique a tabela de medidas reais.
4. **Políticas e conteúdo:** escreva os textos oficiais de entrega, trocas, privacidade, termos e apresentação da empresa. As políticas iniciais estão aguardando estes textos.
5. **Pagamentos:** confira o ambiente, validade de Pix e carteira PicPay e as condições de parcelamento. A chave é configurada no ambiente protegido do servidor. Consulte `PAGAMENTOS.md`.
6. **Preparar lançamento:** confirme estoque, revise as pendências e ative as vendas. A ativação é recusada se faltar chave de produção, dados fiscais válidos, atendimento, frete, estoque confirmado ou políticas. A publicação na Vercel usa o domínio oficial.

## Pedidos

O quadro inicial mostra receita de pagamentos aprovados, quantidade de pedidos reais, estoque disponível e mensagens. Pedidos demonstrativos e sandbox são identificados e não entram na receita. A listagem mostra até 500 pedidos recentes e pode ser filtrada e exportada em CSV.

Abra um pedido para consultar comprador, endereço, itens e distribuição por tamanho. Confira o pagamento pelo provedor original do pedido antes de separar. Cadastre transportadora e rastreio para marcar **Em transporte** e depois **Entregue**. O link HTTPS da nota fiscal pode ser incluído após sua emissão.

A reserva é descontada ao criar uma compra real. Pedidos cancelados ou recusados devolvem sua reserva uma única vez. Um estorno depois da postagem não devolve peças ao estoque automaticamente; confira o recebimento físico e ajuste o estoque quando apropriado. Um pagamento recebido após liberação da reserva fica **Aguardando conferência**.

No PicPay, o cancelamento de uma cobrança pendente exige atendimento: o endpoint de cancelamento também pode estornar uma cobrança recebida durante a operação. A loja mantém a reserva até confirmação de expiração/cancelamento pelo provedor. Estornos financeiros são feitos no painel PicPay e depois sincronizados aqui. Pedidos anteriores permanecem no Pagar.me.

Ao abrir a loja, a manutenção em segundo plano consulta reservas vencidas. O relógio local nunca aprova ou cancela uma cobrança: o PicPay precisa confirmar o estado. Também é possível conferir pedidos individualmente no painel.

## Atendimento e relacionamento

As mensagens do formulário ficam em **Atendimento**. Responda pelo canal de contato do cliente e marque a solicitação como resolvida. Cadastros de novidades podem ser exportados; disparos de campanhas não são automáticos.

O Resend está conectado ao domínio oficial, com a chave privada na Vercel e o remetente `Super Malhas Atacado <noreply@supermalhasatacado.com.br>` nas configurações da loja. Os avisos de pagamento e postagem só são enviados quando o serviço está disponível; testes não enviam e-mails financeiros. Os e-mails de confirmação e recuperação usam o SMTP Resend no Supabase. Consulte [EMAILS.md](EMAILS.md) para configuração, modelos e validação.

## Testar a experiência

Sem credenciais PicPay, novas cobranças ficam indisponíveis. Homologação usa `PICPAY_ENVIRONMENT=test` e credenciais próprias de sandbox. No painel → Pagamentos, marque **Permitir pedidos de homologação PicPay** e salve; isso desativa vendas reais. Esses pedidos não consomem estoque real e podem ser acompanhados pelo comprador com identificação de teste, inclusive QR Code e status. As verificações offline podem ser executadas com `npm run test:picpay`.

O cliente pode comprar como visitante. Ao entrar na conta no mesmo navegador, seus pedidos são vinculados à conta autenticada. Favoritos e carrinho permanecem neste navegador.

## Acessos administrativos

Administradores são definidos por e-mail na variável protegida `ADMIN_EMAILS`, separados por vírgula. Os administradores autorizados são `k2publicidade2@gmail.com` e `supermalhasatacado@gmail.com`; ambos precisam de conta da loja e e-mail confirmado. Outros clientes não podem alterar preços, estoque, pedidos ou configurações.
