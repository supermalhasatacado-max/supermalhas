# E-mails da Super Malhas Atacado

## Configuração de produção

O domínio `supermalhasatacado.com.br` foi verificado no Resend em 10/10/2026, na região São Paulo (`sa-east-1`). A chave de envio foi salva como **Secret**, somente em **Production**, no projeto `supermalhas` da Vercel. A publicação foi atualizada após a inclusão da variável.

O remetente dos pedidos está persistido nas configurações da loja como `Super Malhas Atacado <noreply@supermalhasatacado.com.br>` e pode ser gerenciado pelo painel. O remetente da autenticação está configurado no Supabase com esse endereço e o nome `Super Malhas Atacado`.

| Serviço | Configuração |
| --- | --- |
| Vercel | `RESEND_API_KEY`, privada, sem prefixo `NEXT_PUBLIC_`. |
| Supabase Authentication → Emails → SMTP Settings | SMTP personalizado ativado. |
| Servidor SMTP | `smtp.resend.com`. |
| Porta | `465`, com TLS. |
| Usuário SMTP | `resend`. |
| Senha SMTP | A chave de envio do Resend, armazenada de forma protegida. |

Não colocar a chave em código, documentação, HTML, variáveis públicas ou no GitHub. Se for necessário substituir a chave, atualize a Vercel e o SMTP do Supabase; publique novamente a Vercel e valide as duas conexões. A credencial atual de envio não permite consultar mensagens pela API; a entrega é consultada no dashboard Resend.

## Registros DNS

Os registros abaixo foram adicionados na zona HostGator, com TTL de 300 segundos. O apontamento do site para a Vercel e os registros de recebimento já existentes foram preservados.

| Tipo | Nome | Conteúdo |
| --- | --- | --- |
| TXT | `resend._domainkey` | Chave pública DKIM gerada no dashboard Resend. |
| CNAME | `rsend` | `rsend-sae1.forge.rmta.net`. |
| CNAME | `send` | `send.forge.rmta.net`. |
| TXT | `_dmarc` | `v=DMARC1; p=none;`. |

Consulte os registros exibidos pelo Resend antes de restaurar ou alterar DNS: outra região ou configuração pode produzir valores diferentes. O DMARC atual permite monitorar a autenticação sem rejeitar outras origens de e-mail da empresa.

O domínio não tem subdomínio de rastreamento configurado. Não ativar rastreamento de links de confirmação e recuperação; eles precisam preservar o endereço da loja. Resend é o serviço de envio, não uma caixa de entrada. O e-mail de atendimento e o recebimento de respostas devem ser configurados separadamente pela operação.

## Modelos de autenticação

Modelos em português, com os estilos da loja, foram aplicados no Supabase:

- **Confirm sign up:** assunto `Confirme seu e-mail — Super Malhas Atacado`; fonte em `supabase/templates/confirm-sign-up.html`.
- **Reset password:** assunto `Recupere seu acesso — Super Malhas Atacado`; fonte em `supabase/templates/reset-password.html`.

Ambos usam `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}` e o tipo correspondente (`email` ou `recovery`). O servidor verifica o token no Supabase, cria os cookies da sessão e retorna para a conta ou a página de nova senha. Assim o link não depende do navegador original do cadastro. A confirmação de e-mail continua obrigatória; não habilitar confirmação automática para contornar um problema de envio.

Para editar, abra Authentication → Emails → Templates, selecione o modelo, altere assunto e fonte, revise a prévia e salve. Mantenha os placeholders do Supabase e o caminho `/auth/confirm`.

## Evidência e validação restante

O teste autorizado para `supermalhasatacado@gmail.com`, enviado por `noreply@supermalhasatacado.com.br`, teve status **delivered** no dashboard Resend. A autenticação do servidor SMTP também passou com validação do certificado TLS, sem enviar uma segunda mensagem. Nenhum pedido ou pagamento foi criado nesse teste.

A chave configurada e o remetente permitem os avisos de pagamento e postagem em pedidos reais. Pedidos demonstrativos/sandbox não enviam e-mails financeiros. O teste do serviço não substitui a homologação de pagamentos Pagar.me.

Ainda é necessário concluir o cadastro, confirmar o e-mail, entrar no painel administrativo e testar a recuperação de senha com uma conta real da loja. A senha deve ser criada e enviada pelo titular diretamente no navegador. A conta de administrador do dashboard Supabase é independente da conta da loja.

## Referências

- [Resend com Supabase SMTP](https://resend.com/docs/send-with-supabase-smtp)
- [Modelos de e-mail Supabase](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Rastreamento de e-mails Resend](https://resend.com/docs/dashboard/domains/tracking)
