# Configuração do Stripe Checkout na Rejet Corp

## Valores a substituir

O [servidor financeiro](supabase/functions/finance/stripe.ts) usa `mode=payment` e monta `line_items` em BRL com a cotação real do pedido no PostgreSQL. A configuração de produtos acontece nas negociações da Rejet Corp, sem IDs de preço de exemplo no código.

| Variável | Onde configurar | Valor |
| --- | --- | --- |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `.env.local` para desenvolvimento e variáveis de build do frontend no deploy | Chave publicável `pk_test_…` da plataforma no mesmo sandbox da chave do servidor |
| `STRIPE_SECRET_KEY` | Supabase Edge Functions Secrets | Chave secreta `sk_test_…` da plataforma no sandbox |
| `STRIPE_WEBHOOK_SECRET` | Supabase Edge Functions Secrets | Segredo de assinatura do destino Stripe Connect que aponta para `/functions/v1/finance/webhook` |
| `BILLING_MODE` | Supabase Edge Functions Secrets | `test` |
| `BILLING_APP_ORIGIN` | Supabase Edge Functions Secrets | Origem exata em que o site de teste roda, como `http://localhost:5173`, sem barra final |

As chaves secretas ficam no Supabase. Use apenas a chave publicável no Vite. Reinicie o Vite depois de configurar `.env.local`.

## Parâmetros configurados

- [Payload da Checkout Session](supabase/functions/finance/stripe.ts)
- [Aparência e formulário no financeiro](src/pages/Finance/FinancePage.tsx)
- [Stripe.js Dahlia carregado no HTML](index.html)

| Parâmetro | Valor |
| --- | --- |
| `ui_mode` | `form` |
| `billing_address_collection` | `auto` |
| `phone_number_collection.enabled` | `false` |
| `automatic_tax.enabled` | `false` |
| `submit_type` | `auto` |
| `integration_identifier` | `custom_embedded_web_0001` |
| `payment_method_collection` | Omitido para compra avulsa em `mode=payment` |

## Implantação e teste

1. Confirme no sandbox que a conta Connect vendedora permite cobranças e repasses e tem `card_payments` ativa. No teste anterior, a Stripe informou pendências de cadastro e verificação do representante.
2. Configure a chave publicável e rode `npm.cmd run dev`. Use o Supabase de teste no frontend. O Stripe.js vem de `js.stripe.com` e dispensa instalação de pacote npm. Se houver uma política CSP na hospedagem, permita as origens do Stripe.js conforme o [guia de segurança da Stripe](https://docs.stripe.com/security/guide#content-security-policy).
3. Publique o frontend antes da função Edge `finance` no ambiente de teste. O frontend atualizado aceita sessões hospedadas em andamento. As novas sessões usam `2026-03-25.dahlia`. Em caso de tentativa anterior sem ID persistido que exija conciliação, confira o pedido e a Stripe antes de gerar outra cobrança.
4. Como comprador fictício, abra uma negociação aceita e selecione **Abrir pagamento** no detalhe do pedido. Teste sucesso (`4242 4242 4242 4242`), autenticação 3DS (`4000 0025 0000 3155`) e recusa (`4000 0000 0000 9995`) com cartões de teste. Use validade futura e CVC de teste. [Cartões de teste](https://docs.stripe.com/testing#cards)
5. A função devolve o segredo da sessão ao comprador autenticado e o Stripe.js monta o iframe na conta conectada do vendedor. Confira no painel da Stripe a cobrança, a comissão e a entrega do webhook ao Supabase. O status do pedido depende da conciliação. Prossiga com envio, confirmação de recebimento e teste de estorno dentro de 7 dias. [Fluxo financeiro e eventos do webhook](docs/finance.md#ativar-em-um-ambiente-de-teste)

Este guia foi adicionado na raiz do projeto. A integração usa a página Financeiro e a função `finance` já existentes. Alterações de catálogo, valor e quantidade continuam nas negociações. Acompanhe pagamentos, entrega e estornos no detalhe do pedido.

[Suporte Stripe](https://support.stripe.com) · [Stripe MCP](https://docs.stripe.com/mcp)
