# Supabase — SUPER MALHAS ATACADO

Projeto informado: `ihjmwbyactdbltghundz`, organização Supermalhas. A URL pública do projeto está em `supabase/project.json`. Chaves ficam exclusivamente nas variáveis protegidas do servidor.

## Estrutura

O schema `supermalhas` contém nove tabelas: `settings`, `products`, `coupons`, `orders`, `order_events`, `profiles`, `contacts`, `newsletter` e `rate_limits`. JSON é armazenado como JSONB, datas como `timestamptz` e valores financeiros como inteiros em centavos. Índices atendem ao histórico, painel, eventos e manutenção de reservas.

Todas as tabelas têm RLS e acesso direto revogado para `anon` e `authenticated`. O backend usa a chave secreta; suas rotas verificam a identidade e a propriedade de cada pedido. A autenticação existente do Sites continua responsável pelo login. Nenhuma chave Supabase é enviada ao navegador.

As funções `sm_database_v1` e `sm_import_d1_v1` têm `SECURITY INVOKER`, caminho de schema fixo e execução limitada a `service_role`. A função de operações aceita somente identificadores registrados e parâmetros vinculados; não aceita SQL do cliente. Um lote é uma transação. O mesmo bloqueio transacional protege reserva, liberação, uso de cupons e atualizações administrativas.

O bucket `supermalhas-products` é privado, permite JPG/PNG/WebP e limita cada imagem a 5 MB. Uploads exigem administrador. A vitrine recebe as imagens pelo endpoint `/api/media/:id`; imagens anteriores no R2 continuam disponíveis durante a transição.

## Aplicação no projeto real

1. Conferir a referência `ihjmwbyactdbltghundz` antes de qualquer operação.
2. Aplicar, em ordem, os arquivos de `supabase/migrations/`. As migrações alteram somente o schema da loja, as duas funções com prefixo `sm_` e o bucket específico. Não removem dados ou objetos de outras aplicações.
3. Configurar no servidor do Site: `DATABASE_PROVIDER=supabase`, `SUPABASE_URL=https://ihjmwbyactdbltghundz.supabase.co` e `SUPABASE_SECRET_KEY` com uma chave secreta existente. Uma chave legada `SUPABASE_SERVICE_ROLE_KEY` também é suportada. Preferir a chave `sb_secret_` atual. Nunca usar chave publishable/anon no backend administrativo.
4. Para preservar o banco D1 atual, manter o binding `DB` e configurar `SUPABASE_MIGRATE_D1=true` na primeira publicação. Quando o banco de destino está vazio, a primeira inicialização copia as nove tabelas em uma única transação e registra as contagens em `settings`, chave `migration:d1`. O D1 não é modificado. Falha na importação bloqueia a inicialização em vez de criar uma loja vazia. Importações acima de 10 mil registros por tabela exigem um fluxo por lotes.
5. Conferir catálogo, configurações, histórico, propriedade dos pedidos e contagens da migração. Validar uma compra demonstrativa e um upload pelo painel.
6. Após conferir a migração, definir `SUPABASE_MIGRATE_D1=false`. Preservar o D1/R2 como origem de recuperação até concluir a conferência. O banco de destino não é sobrescrito em inicializações posteriores.

Um Supabase configurado com erro não usa silenciosamente outro banco. Sem a configuração Supabase, a versão existente continua usando D1; isso permite publicar o adaptador antes da troca de credenciais. Reverter o provedor depois de novas vendas exige reconciliar os registros novos para evitar divergência.

## Desenvolvimento e validação

Copiar `.dev.vars.example` para `.dev.vars` e preencher a chave localmente. O arquivo preenchido é ignorado pelo Git. Para continuar com o banco local D1, usar `DATABASE_PROVIDER=d1`.

```sh
node scripts/supabase-contract.mjs --check
node tests/supabase.mjs
node tests/commerce.mjs
node node_modules/typescript/bin/tsc --noEmit
node scripts/run-framework.mjs build
```

O teste Supabase executa as migrações em PostgreSQL via PGlite e usa o código real da loja com serviços externos simulados. Confere RLS, restrição das funções, reserva concorrente, cupom, rollback, idempotência, propriedade, parâmetros contra injeção e migração de D1. Não usa dados nem credenciais de produção. Testes locais não confirmam que as migrações ou credenciais foram aplicadas no projeto remoto.

O catálogo em `db/supabase-statements.json` e a migração inicial compartilham o contrato. `--check` detecta divergências. Depois de aplicar uma migração, ela é imutável; futuras operações exigem uma nova migração e atualização explícita do contrato.

## Referências

- [Chaves e papéis do Supabase](https://supabase.com/docs/guides/getting-started/api-keys)
- [Segurança de funções](https://supabase.com/docs/guides/database/functions)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Controle de acesso ao Storage](https://supabase.com/docs/guides/storage/security/access-control)
