# Supabase — SUPER MALHAS ATACADO

Projeto: `ihjmwbyactdbltghundz`, organização Supermalhas. URL: `https://ihjmwbyactdbltghundz.supabase.co`. Produção na Vercel; Next.js 16 e Node.js 24.

## Banco e imagens

O schema `supermalhas` contém nove tabelas: `settings`, `products`, `coupons`, `orders`, `order_events`, `profiles`, `contacts`, `newsletter` e `rate_limits`. Valores financeiros são inteiros em centavos. JSON é JSONB; datas são timestamptz.

Todas as tabelas têm RLS, e o acesso direto é revogado para `anon` e `authenticated`. As funções públicas `sm_database_v1` e `sm_import_d1_v1` só podem ser executadas pelo servidor com papel `service_role`. Aceitam operações fixas e parâmetros, nunca SQL arbitrário do cliente. Cada lote é uma transação, com bloqueio compartilhado para reserva/liberação de estoque e uso de cupons.

O bucket `supermalhas-products` é privado, suporta PNG/JPEG/WebP e limita arquivos a 5 MB. A aplicação limita uploads a 4 MB para caber na requisição da Vercel. A foto inicial dos três pacotes foi enviada ao bucket e vinculada ao catálogo; leitura pelo servidor, integridade do arquivo, acesso privado direto e entrega pelo domínio foram verificados. Uploads exigem administrador com e-mail confirmado; a vitrine serve as imagens pelo endpoint `/api/media/:id`.

## Variáveis da Vercel

| Variável | Visibilidade e finalidade |
| --- | --- |
| `DATABASE_PROVIDER=supabase` | Servidor; seleciona PostgreSQL. |
| `SUPABASE_URL` | Servidor; URL oficial do projeto. |
| `SUPABASE_SECRET_KEY` | Segredo de produção; chave existente secreta ou JWT legado service_role. |
| `NEXT_PUBLIC_SUPABASE_URL` | Pública; mesmo projeto, usado pelo login. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Pública; chave publishable, nunca secret/service_role. |
| `SITE_URL` | URL HTTPS principal: https://supermalhasatacado.com.br. |
| `ADMIN_EMAILS` | Allowlist de e-mails administrativos separados por vírgula. |

Use somente produção para as credenciais do banco real. Configure um projeto separado para ambientes de desenvolvimento/preview que precisem gravar dados. Uma configuração inválida não usa silenciosamente um banco alternativo.

## Autenticação

O login e a recuperação de senha usam Supabase Auth com `@supabase/ssr`, cookies e renovação de sessão em `proxy.ts`. O servidor verifica o usuário com `auth.getUser()`. Cabeçalhos de identidade e o antigo cookie local do Sites não concedem acesso.

Administradores precisam ter e-mail confirmado e constar em `ADMIN_EMAILS`. Os pedidos são acessíveis ao dono da sessão/cookie visitante ou ao administrador. Entrar na conta no mesmo navegador vincula os pedidos daquele visitante.

No dashboard, Authentication → URL Configuration:

- Site URL: `https://supermalhasatacado.com.br`.
- Retorno de produção: `https://supermalhasatacado.com.br/auth/callback**`.
- Retorno pelo domínio Vercel: `https://supermalhas-smoky.vercel.app/auth/callback**`.
- Desenvolvimento: `http://localhost:3000/auth/callback**`.

O wildcard fica restrito ao caminho de retorno da loja. A aplicação valida `return_to` para impedir retornos para domínios externos. `/auth/confirm` também aceita templates com TokenHash para confirmação sem depender do navegador original.

O SMTP de produção foi conectado ao Resend, com domínio verificado, porta 465/TLS e remetente `noreply@supermalhasatacado.com.br`. Os modelos de confirmação e recuperação foram aplicados em português e usam `/auth/confirm` com TokenHash. Consulte [a configuração e a evidência dos e-mails](EMAILS.md). A confirmação de e-mail continua obrigatória. O SMTP padrão do Supabase, limitado à equipe do projeto, não é usado para os e-mails de produção.

## Migrações e recuperação

As três migrações de `supabase/migrations/` foram aplicadas no projeto real através do SQL Editor em uma transação. Verificado: nove tabelas, nove com RLS e bucket privado.

Migrações aplicadas são imutáveis. Novas operações exigem nova migração e atualização de `db/supabase-statements.json`. `node scripts/supabase-contract.mjs --check` detecta divergências.

A função `sm_import_d1_v1` permite importar as nove tabelas de um snapshot autorizado do D1, com contagens e marcador `migration:d1`; não sobrescreve um destino já inicializado. O D1 original deve permanecer preservado. Identidades antigas do Sites e novas identidades do Supabase são sistemas distintos; qualquer migração de pedidos reais também precisa conferir a propriedade das contas. Não considerar um fixture local como backup da publicação antiga.

## Verificação

```sh
npm test
npm run build
node tests/http.mjs
```

O teste offline usa PostgreSQL/PGlite e serviços simulados. O teste HTTP consulta `/api/health` e as rotas da publicação selecionada; não comprova entrega de e-mail ou cobrança real. Verifique cadastro, confirmação, login, recuperação de senha e upload com a conta do administrador após configurar SMTP.

## Documentação oficial

- [Autenticação SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Segurança do Storage](https://supabase.com/docs/guides/storage/security/access-control)
