# SUPER MALHAS ATACADO

Loja em Next.js 16, publicada na Vercel, com PostgreSQL, imagens privadas e autenticação no Supabase. Inclui catálogo, grades P/M/G/GG, favoritos, carrinho, cupons, frete, checkout, histórico de pedidos e painel administrativo.

## Endereços e acesso

- Loja: https://supermalhasatacado.com.br
- Painel: https://supermalhasatacado.com.br/admin
- Login: https://supermalhasatacado.com.br/entrar
- Supabase: projeto `ihjmwbyactdbltghundz`.
- Administradores autorizados: `supermalhasatacado@gmail.com` e `k2publicidade2@gmail.com`, configurados em `ADMIN_EMAILS` na Vercel.

O acesso exige uma conta do Supabase com e-mail confirmado. A conta da administração do Supabase não cria automaticamente uma conta na loja. Cadastre-se na loja e confirme o e-mail. Nunca compartilhar senha ou chave secreta no GitHub.

## Dados iniciais

ANABELA AG MODAS LTDA, CNPJ 58.312.831/0001-89, Rua Dez de Abril, s/n, Alto da Cruz, Camaçari/BA, CEP 42803-113. Os pacotes de 200, 300 e 400 peças custam R$ 5.000, R$ 7.500 e R$ 10.000.

Estoque inicial zero e vendas reais desativadas. Contatos, políticas, frete, estoque, imagens e textos são gerenciados pelo painel. As compras demonstrativas não cobram, não reservam estoque e não consomem cupons. A chave Pagar.me e a homologação do provedor continuam necessárias para receber pagamentos reais.

## Desenvolvimento

Node.js 24 e npm. Copie `.env.example` para `.env.local` e preencha as credenciais de um projeto de desenvolvimento. O arquivo preenchido é ignorado pelo Git.

```sh
npm ci
npm run dev
npm test
npm run build
npm start
```

Com o servidor ativo, `node tests/http.mjs` verifica catálogo, saúde do banco, rotas privadas e rejeição de identidade falsificada. Para um endereço remoto selecionado explicitamente, use `TEST_URL` e `TEST_ALLOW_REMOTE=true`. O teste HTTP não altera estoque/configurações nem cria pedidos ou clientes.

Os testes offline executam as migrações em PostgreSQL/PGlite e verificam transações, concorrência, estoque, cupons, pagamentos simulados, propriedade dos pedidos e importação D1. Os testes de autenticação verificam sessão confirmada, e-mail verificado, restrições de chave pública e retornos seguros. Não substituem a homologação Pagar.me.

## Implantação

O repositório GitHub conecta a branch `main` ao projeto `supermalhas` na Vercel. `vercel.json` declara Next.js, instalação com `npm ci`, build e região. Configure as variáveis de produção antes de publicar e redeploy após alterá-las.

A chave pública `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` permite somente a autenticação e os acessos liberados pelas políticas. `SUPABASE_SECRET_KEY` é privada, usada exclusivamente pelo servidor. O banco comercial e o Storage não permitem acesso direto pelos clientes.

`/api/health` verifica o catálogo persistido, o bucket privado e o serviço Supabase Auth com confirmação de e-mail exigida. Retorna erro se a conexão estiver incompleta; não apresenta chaves nem dados de clientes. Não valida entrega de e-mails ou credenciais Pagar.me.

A versão anterior em `chatgpt.site` e os arquivos históricos do Sites/D1 permanecem preservados para recuperação. A publicação atual usa Vercel; os scripts históricos do Sites não são o fluxo de build atual. Não importar dados de demonstração locais como se fossem os dados do site anterior.

## Guias

- [Administração](docs/ADMIN.md)
- [Supabase e autenticação](docs/SUPABASE.md)
- [Pagamentos Pagar.me](docs/PAGAMENTOS.md)
- [Imagens](docs/ASSETS.md)

Valores são recalculados no servidor. A aprovação do pagamento exige consulta autenticada ao Pagar.me; o retorno do checkout e o corpo do webhook não confirmam pagamento. Estornos financeiros são feitos no Pagar.me. O link da nota fiscal emitida pode ser cadastrado no pedido.
