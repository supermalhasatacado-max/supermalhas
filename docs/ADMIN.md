# Guia de gestão da Super Malhas

Entre em `/admin` com sua conta da loja, autenticada pelo Supabase e com e-mail confirmado. O servidor verifica a autorização em todas as operações. A conta do dashboard Supabase não cria automaticamente uma conta de cliente; faça o cadastro pela loja.

## Configurar a operação

1. **Dados da empresa:** revise razão social, CNPJ, telefone, endereço e CEP de origem. Cadastre e-mail de atendimento, WhatsApp e horário. O e-mail fiscal permanece separado do contato público. O nome fantasia cadastral ANABELA BOUTIQUE foi informado pela empresa; a marca comercial desta vitrine é SUPER MALHAS ATACADO.
2. **Produtos e estoque:** informe o estoque disponível em pacotes, preços, descrições, características e fotos. Use o envio de imagem para JPG, PNG ou WebP de até 4 MB. Publique ou oculte produtos e escolha os destaques.
3. **Frete e entrega:** cadastre nome do serviço, estados atendidos, preço, prazo mínimo/máximo e eventual frete grátis por valor. São regras comerciais definidas por você; o cálculo não consulta uma transportadora. Publique a tabela de medidas reais.
4. **Políticas e conteúdo:** escreva os textos oficiais de entrega, trocas, privacidade, termos e apresentação da empresa. As políticas iniciais estão aguardando estes textos.
5. **Pagamentos:** confira o ambiente, validade de Pix e boleto e as condições de parcelamento. A chave é configurada no ambiente protegido do servidor. Consulte `PAGAMENTOS.md`.
6. **Preparar lançamento:** confirme estoque, revise as pendências e ative as vendas. A ativação é recusada se faltar chave de produção, dados fiscais válidos, atendimento, frete, estoque confirmado ou políticas. A publicação na Vercel usa o domínio oficial.

## Pedidos

O quadro inicial mostra receita de pagamentos aprovados, quantidade de pedidos reais, estoque disponível e mensagens. Pedidos demonstrativos e sandbox são identificados e não entram na receita. A listagem mostra até 500 pedidos recentes e pode ser filtrada e exportada em CSV.

Abra um pedido para consultar comprador, endereço, itens e distribuição por tamanho. Confira o pagamento pelo Pagar.me antes de separar. Cadastre transportadora e rastreio para marcar **Em transporte** e depois **Entregue**. O link HTTPS da nota fiscal pode ser incluído após sua emissão.

A reserva é descontada ao criar uma compra real. Pedidos cancelados ou recusados devolvem sua reserva uma única vez. Um estorno depois da postagem não devolve peças ao estoque automaticamente; confira o recebimento físico e ajuste o estoque quando apropriado. Um pagamento recebido após liberação da reserva fica **Aguardando conferência**.

O botão **Cancelar tentativa sem pagamento** desativa o link e consulta o provedor. Uma cobrança pendente de Pix/boleto mantém a reserva até confirmação, mesmo com o link cancelado. Estornos de pagamentos aprovados são feitos no painel Pagar.me e depois sincronizados aqui.

Ao abrir a loja, a manutenção em segundo plano confere até três reservas vencidas por minuto. Links expirados sem nenhuma sessão são cancelados e liberados. Um boleto emitido não é cancelado somente porque o link expirou. Também é possível conferir pedidos individualmente no painel.

## Atendimento e relacionamento

As mensagens do formulário ficam em **Atendimento**. Responda pelo canal de contato do cliente e marque a solicitação como resolvida. Cadastros de novidades podem ser exportados; disparos de campanhas não são automáticos.

O Resend está conectado ao domínio oficial, com a chave privada na Vercel e o remetente `Super Malhas Atacado <noreply@supermalhasatacado.com.br>` nas configurações da loja. Os avisos de pagamento e postagem só são enviados quando o serviço está disponível; testes não enviam e-mails financeiros. Os e-mails de confirmação e recuperação usam o SMTP Resend no Supabase. Consulte [EMAILS.md](EMAILS.md) para configuração, modelos e validação.

## Testar a experiência

Sem chave, o pré-lançamento oferece compras demonstrativas. O administrador pode simular pagamento aprovado/recusado no pedido. Com uma chave `sk_test_...` e ambiente `test`, o checkout passa a utilizar o sandbox Pagar.me. A página identifica o teste e os pedidos não consomem estoque real.

O cliente pode comprar como visitante. Ao entrar na conta no mesmo navegador, seus pedidos são vinculados à conta autenticada. Favoritos e carrinho permanecem neste navegador.

## Acessos administrativos

Administradores são definidos por e-mail na variável protegida `ADMIN_EMAILS`, separados por vírgula. Os administradores autorizados são `k2publicidade2@gmail.com` e `supermalhasatacado@gmail.com`; ambos precisam de conta da loja e e-mail confirmado. Outros clientes não podem alterar preços, estoque, pedidos ou configurações.
