# SUPER MALHAS ATACADO

Ecommerce em português com vitrine responsiva, catálogo, grades P/M/G/GG, favoritos, carrinho, cupons, cálculo de frete, checkout, histórico de pedidos e painel administrativo. A identidade visual usa o logotipo fornecido, laranja, grafite e fotografia de camisetas brancas.

## Acessos

- Loja: https://super-malhas-atacado.loucassio.chatgpt.site
- Painel: https://super-malhas-atacado.loucassio.chatgpt.site/admin
- Administrador inicial: conta ChatGPT `k2publicidade2@gmail.com`.

A publicação inicial é privada, para revisão. O acesso de clientes e o recebimento de webhooks externos exigem que a audiência seja aberta no lançamento. As vendas começam desativadas. Não há chave de pagamento no código.

## Guias

- [Gestão da loja](docs/ADMIN.md)
- [Configuração e homologação Pagar.me](docs/PAGAMENTOS.md)
- [Banco e imagens no Supabase](docs/SUPABASE.md)
- [Imagens e identidade visual](docs/ASSETS.md)
- [Detalhes da plataforma](README.platform.md)

## Dados iniciais

ANABELA AG MODAS LTDA, CNPJ 58.312.831/0001-89, Rua Dez de Abril, s/n, Alto da Cruz, Camaçari/BA, CEP 42803-113. Telefone fixo (71) 3627-6849. O e-mail fiscal é administrativo; o e-mail de atendimento e WhatsApp podem ser preenchidos no painel.

Os pacotes de 200, 300 e 400 peças custam R$ 5.000, R$ 7.500 e R$ 10.000. Estoque inicial zero. Os pedidos demonstrativos permitem revisar a experiência sem cobrança e sem alterar estoque ou usos de cupons.

## Desenvolvimento

Node.js 22.13+ (os testes offline usam Node.js 24) e npm.

```sh
npm install
node scripts/run-framework.mjs dev --hostname 127.0.0.1 --port 5186
node node_modules/typescript/bin/tsc --noEmit
node tests/commerce.mjs
node tests/supabase.mjs
node tests/http.mjs
node scripts/run-framework.mjs build
```

`tests/http.mjs` exige o servidor local ativo e recusa hosts externos. Usa a autenticação simulada oficial do starter, cria registros de teste locais e restaura configurações/estoque. `tests/commerce.mjs` usa SQLite em memória e um provedor simulado, sem rede ou credenciais reais; verifica reserva atômica, estoque, cupons, idempotência, juros preservados, confirmação autenticada, estorno, sandbox e propriedade dos pedidos. Esses testes não substituem a homologação no Pagar.me.

## Persistência e implantação

O backend suporta Supabase PostgreSQL e Storage privado, com migrações em `supabase/migrations/`, operações transacionais e importação do D1 existente. A troca ocorre ao configurar `DATABASE_PROVIDER=supabase` e as credenciais protegidas conforme [o guia Supabase](docs/SUPABASE.md). Até essa configuração, a publicação existente usa Cloudflare D1/R2. Carrinho e favoritos ficam no navegador. O histórico de migrações D1 em `drizzle/` permanece preservado.

O fluxo Sites preserva `.openai/hosting.json` e publica uma versão do commit enviado. Segredos são configurados nas variáveis do servidor: `ADMIN_EMAILS`, `SUPABASE_SECRET_KEY`, `PAGARME_SECRET_KEY`, `PAGARME_ENVIRONMENT` e, opcionalmente, `RESEND_API_KEY`. Nunca incluir chaves no Git, arquivos públicos ou JavaScript do navegador.

Preços, descontos, frete e somas de grade são recalculados no servidor. A aprovação depende de consulta autenticada ao Pagar.me; a página de retorno e o conteúdo recebido de um webhook não aprovam pagamentos. Reembolso financeiro é realizado no painel do Pagar.me, com sincronização na loja. A nota fiscal é emitida pelo serviço fiscal da empresa e seu link pode ser cadastrado no pedido.
