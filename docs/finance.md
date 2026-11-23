# Financeiro da Rejet Corp

Quando a negociação é aceita, o comprador pode confirmar Pix, cartão de crédito ou boleto. A escolha fica registrada na negociação e libera a finalização. Materiais gratuitos dispensam essa etapa. A confirmação registra a escolha sem criar pedido nem cobrar. O fluxo de integração em pedidos já existentes usa a função Supabase para validar o evento assinado e consultar a Stripe antes de atualizar o pagamento. Consulte o [guia de configuração do checkout](../STRIPE_INTEGRATION_TODO.md).

Aplique a migração [`20261122003000`](../supabase/migrations/20261122003000_require_negotiation_payment_confirmation.sql) antes de publicar o frontend atualizado. Negociações aceitas e ainda não finalizadas passam a exigir confirmação, com a exceção de materiais gratuitos.

Novas cotações usam preço, quantidade e unidade registrados no aceite pela migração [`20261122005000`](../supabase/migrations/20261122005000_pin_company_identity_and_negotiation_terms.sql). Edite o anúncio normalmente para atualizar o catálogo. O valor acordado na negociação continua associado à proposta aceita.

## Decisão de gateway

Documentação do provedor consultada em 22 de novembro de 2026.

| Opção | Adequação e limite |
| --- | --- |
| Stripe Connect com cobranças diretas | Checkout incorporado, comissão aplicada à cobrança da conta vendedora, Pix e cartão conforme as capacidades da conta, estornos totais e parciais conforme o método, eventos de pagamento, disputa e repasse. O boleto Stripe aceita cobrança, mas não oferece estorno. Por isso, este sistema mantém boleto desabilitado. |
| Mercado Pago Split 1:1 | Checkout Pro hospedado com token OAuth por vendedor e split. A devolução integral pode depender de saldo suficiente do vendedor. É uma opção futura se os requisitos comerciais de métodos e cadastro forem mais bem atendidos nesse modelo. |
| Pagar.me | O split oferece configuração de recebedores para clientes PSP. A habilitação contratual, o preço e os recursos por método precisam ser confirmados para a conta antes de adotar outro adaptador. |

A escolha usa um único provedor. A Stripe controla os saldos e o calendário de repasses. O sistema não retém dinheiro até a confirmação da entrega e não oferece carteira. Taxas de cartão, Pix, Connect, contestação e estorno seguem o contrato do vendedor e da plataforma. Os valores lidos do gateway são separados da comissão. O painel mostra comissão após reversões. Despesas contratuais que não aparecem no objeto da cobrança ficam fora desse indicador. Consulte os [preços Stripe Brasil](https://stripe.com/br/pricing), [preços Connect](https://stripe.com/br/connect/pricing), [cobranças diretas](https://docs.stripe.com/connect/direct-charges), [Pix](https://docs.stripe.com/payments/pix), [boleto](https://docs.stripe.com/payments/boleto), [split Mercado Pago](https://www.mercadopago.com.br/developers/en/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace) e [split Pagar.me](https://docs.pagar.me/reference/split-1).

## Dados e operações

- `finance_orders` captura o valor, a comissão, a empresa vendedora, a quantidade e a política de reversão. Cada negociação aceita gera no máximo um pedido, e cada anúncio representa um único lote financeiro. A compra de parte do saldo por várias empresas exige gestão de estoque separada. Os estados comercial e financeiro são independentes.
- `finance_sellers` liga a empresa a uma conta Connect brasileira por ambiente. O administrador confere a propriedade no painel Stripe e registra a conta conectada. O backend consulta as capacidades antes de habilitar métodos no checkout. A conta Connect e seu KYC seguem o processo da Stripe.
- `finance_refunds`, `finance_disputes` e `finance_payouts` separam solicitações, contestações e repasses. Repasses representam valores agregados reais do gateway. Podem incluir vendas fora da plataforma e não são atribuídos a um pedido individual.
- `finance_events` registra ações, atores, notificações, eventos verificados e tentativas de conciliação. O bucket privado `finance-evidence` aceita PDF, JPG e PNG de até 5 MB. Defina retenção, revisão de anexos e limpeza de uploads órfãos antes de operar com documentos reais.
- `finance_command` valida a empresa ativa e executa cotação, criação, envio, recebimento e decisões administrativas. `finance_summary` agrega apenas registros em produção. `finance_find_companies` permite pesquisa administrativa por nome ou ID. Os registros são lidos sob RLS e modificados por funções autorizadas.
- `POST /functions/v1/finance` aceita sessão Supabase para checkout, vínculo de vendedor, estorno e conciliação. `POST /functions/v1/finance/webhook` usa assinatura Stripe sobre o corpo bruto, resolução do estado oficial e deduplicação no banco. `POST /functions/v1/finance/deadlines` aceita apenas o segredo operacional e envia lembretes de vencimento sem duplicar. Configure a execução periódica no ambiente autorizado.

Somente o comprador confirma a entrega. O banco armazena o instante da primeira confirmação em `timestamptz` e soma 168 horas. O último instante é inclusivo. Confirmar novamente devolve as mesmas datas. A ausência de confirmação não comprova entrega. Contestação sem data de recebimento passa por análise administrativa. Nos casos elegíveis, o administrador pode registrar uma exceção ao prazo com justificativa. A regra comercial padrão não substitui direitos legais aplicáveis. Confirme o tratamento contratual B2B, o [CDC](https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm), a privacidade e as responsabilidades fiscais com os responsáveis da operação.

## Ativar em um ambiente de teste

1. Revise as migrações `20261122000000`, `20261122001000` e `20261122002000`. Aplique em ordem em um Supabase descartável autorizado, já com o esquema do aplicativo. Use banco e credenciais separados da produção.
2. Configure os segredos somente na função Edge. O Supabase injeta `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`. Defina `BILLING_MODE=test`, `STRIPE_SECRET_KEY` com chave de teste, `STRIPE_WEBHOOK_SECRET` do endpoint Connect, `BILLING_APP_ORIGIN` com a origem exata e sem barra final, e `BILLING_CRON_SECRET` com um valor aleatório de alta entropia. `STRIPE_API_VERSION` é opcional, mas deve ser fixada à versão validada para o ambiente comercial. As chaves acima nunca usam prefixo `VITE_`.
3. Faça deploy da função `finance` no Supabase de teste. A configuração desativa a validação JWT do gateway da função porque webhooks usam assinatura Stripe. O código valida o JWT nas operações do cliente e o segredo na rota de lembretes.
4. Configure o endpoint Stripe para eventos de **contas conectadas**. Assine `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.succeeded`, `payment_intent.processing`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.updated`, `charge.refunded`, eventos `refund.*` aplicáveis, `charge.dispute.*` e `payout.*`. As referências são [webhooks Connect](https://docs.stripe.com/connect/webhooks) e [assinaturas](https://docs.stripe.com/webhooks/signature).
5. Em **Financeiro → Gestão financeira**, vincule o ID da empresa à conta Stripe de teste, confirme a comissão e habilite os métodos validados. Use comprador e vendedor fictícios. Confirme sucesso, falha, expiração, duplicidade, estorno e repasse no sandbox antes de usar contas reais. Verifique o método Pix, a política antifraude e o segmento de atividade na conta conectada.
6. Configure o agendador aprovado para chamar `/functions/v1/finance/deadlines` com o segredo. O processamento cria apenas notificações internas. E-mail depende da infraestrutura e da autorização de envio.

## Produção, conciliação e reversão

- Liberação comercial exige contrato Connect, contas verificadas, decisão sobre tarifas, revisão B2B, retenção de anexos, integração de monitoramento, ensaio de contestação e validação em sandbox. Use ambientes separados. Mantenha `BILLING_LIVE_ENABLED` ausente ou desligado até aprovar o go-live.
- Para habilitar explicitamente, configure `BILLING_MODE=live`, `BILLING_LIVE_ENABLED=true`, chave live e o segredo Connect live. Cadastre os vendedores e a taxa administrativa nesse ambiente. Sem isso, a função recusa cobranças. Pedidos de teste não mudam de ambiente e não aparecem nos totais reais.
- Use **Consultar gateway** para atualizar tarifas, reversões atrasadas ou estornos de pedidos conhecidos. Estornos iniciados no painel Stripe aparecem no total conciliado. O detalhamento de estornos sem solicitação Rejet permanece no painel Stripe. As taxas de repasse e outras tarifas do contrato não são simuladas como custo de um pedido.
- A tentativa com chave idempotente fica vinculada ao pedido ou estorno. O backend só aceita eventos de pagamento ligados à sessão criada e gravada pelo servidor. Se uma referência não foi gravada e a operação ultrapassou 23 horas, interrompa a tentativa e confira o painel Stripe e os registros operacionais. Não troque a chave para forçar nova cobrança. A recuperação de um checkout sem vínculo exige reconciliação administrativa auditada. Estornos podem ser reconferidos pelos metadados da solicitação. Sessão expirada não gera uma segunda cobrança automaticamente.
- Se precisar desativar novas cobranças, desligue `enabled` no painel e expire sessões abertas no gateway pelos procedimentos do provedor. Preserve webhooks e conciliação de operações já iniciadas. O fluxo de estornos continua disponível com o gateway correspondente ativo. Preserve as tabelas de auditoria. Nenhuma migração destrutiva é necessária.

## Verificações locais

```powershell
npm.cmd run check
deno check supabase/functions/finance/index.ts
deno test supabase/functions/finance/stripe.test.ts
```

Os testes do banco executam o esquema do projeto e as novas migrações em PostgreSQL descartável via PGlite. Para evitar alterações no lockfile do aplicativo, instale a versão de teste em uma pasta temporária.

```powershell
$financeTestDir = Join-Path $env:TEMP ('rejet-finance-test-' + [guid]::NewGuid())
npm.cmd install --prefix $financeTestDir --ignore-scripts --no-audit @electric-sql/pglite@0.5.17
$env:FINANCE_PGLITE_MODULE = Join-Path $financeTestDir 'node_modules/@electric-sql/pglite/dist/index.js'
node.exe --test tests/finance.database.test.mjs
```

O PGlite usa primitivas locais de autenticação e Storage e valida SQL, RLS e transições. O teste do adaptador valida payloads e assinaturas de teste. Nenhum deles valida um pagamento ou repasse na Stripe. O sandbox oficial exige uma conta Connect e credenciais de teste autorizadas. O pacote também precisa de revisão operacional e de segurança no ambiente de homologação antes de operar com dinheiro.

Validação no Chrome com respostas locais simuladas cobriu a área do comprador, a confirmação de recebimento, o prazo após a confirmação, a solicitação de estorno e a configuração administrativa. O serviço simulado não implementa o canal Realtime. Nenhuma cobrança, conta Stripe, credencial bancária, migração remota ou transação real integrou o teste.

## Inventário de arquivos

Adicionados:

- `supabase/migrations/20261122000000_finance_core.sql`, `20261122001000_finance_gateway.sql` e `20261122002000_finance_summary.sql`.
- `supabase/config.toml` e `supabase/functions/finance/{index.ts,stripe.ts,stripe.test.ts}`.
- `src/services/finance/financeService.ts`, `src/components/finance/OrderCheckout.tsx` e `src/pages/Finance/{FinancePage.tsx,FinancePage.module.css}`.
- `tests/finance.database.test.mjs` e este documento.

Modificados: `PRODUCT.md`, `docs/architecture.md`, `src/routes/AppRoutes.tsx`, `src/components/layout/AppLayout/AppLayout.tsx` e `src/pages/Negociacoes/NegociacaoDetailPage.tsx`.
