# Arquitetura

O Vite inicia a SPA em `src/main.tsx`. O React Router define a navegação em `src/routes/AppRoutes.tsx`. A home, a página de transparência e a redefinição de senha têm rotas públicas. `PrivateRoute` controla o acesso visual às páginas de sessão, incluindo marketplace, produtos, negociações e administração.

O marketplace lê a busca, os filtros, a ordenação e a página da URL. Ao abrir um produto pelo catálogo, o link de volta reaproveita a busca original. O editor de produto usa o bloqueio de navegação do React Router e o aviso do navegador para proteger alterações ainda não salvas.

Ao abrir uma rota privada sem sessão, o login guarda o caminho, a busca e o fragmento no estado da navegação. Depois de autenticar, o usuário volta ao destino interno solicitado. Endereços desconhecidos mostram a página de rota inexistente.

Dashboard e Relatórios calculam indicadores a partir das mesmas listas paginadas de produtos e negociações. Os gráficos mensais usam os últimos 12 meses. Vendas e compras concluídas contam somente negociações finalizadas. O valor negociado inclui também os acordos aceitos e não representa recebimentos.

Dashboard e Relatórios podem ler negociações em bancos anteriores às migrações de termos aceitos. Nesses bancos, os indicadores usam os campos disponíveis. Quando um acordo não tem valor confirmado, o total negociado fica indisponível. Os fluxos de alteração e aceite continuam dependendo das migrações.

`src/contexts/` mantém sessão e estado compartilhado. `src/pages/` compõe os fluxos. Componentes de interface compartilhados ficam em `src/components/ui/`. Serviços sob `src/services/` fazem a integração com Supabase. Os tipos e utilitários ficam em `src/types/` e `src/utils/`.

A autorização sobre registros e arquivos depende das políticas e funções do Supabase. O bloqueio no roteador e a validação no navegador complementam essas regras. Revise as migrações em `supabase/migrations/` na ordem dos arquivos e considere o estado do ambiente antes de aplicar qualquer SQL. O build não aplica migrações.

O aceite de uma proposta reserva o lote e marca o anúncio como vendido na mesma transação. A migração [`20261122004000`](../supabase/migrations/20261122004000_protect_company_verification_and_lot_reservation.sql) também revoga o selo quando CNPJ, razão social ou nome fantasia mudam. Aplique-a antes do frontend atualizado. A migração marca como vendidos os anúncios ainda ativos com proposta aceita ou finalizada e preserva o histórico das negociações. Revise casos de lotes que já tenham mais de uma proposta aceita antes da implantação.

Anexos de produtos são abertos por links assinados do bucket `produtos`. Referências antigas ao mesmo bucket são convertidas em caminhos internos antes da assinatura.

A migração [`20261122005000`](../supabase/migrations/20261122005000_pin_company_identity_and_negotiation_terms.sql) vincula cada aprovação administrativa à versão do cadastro exibida e registra preço unitário, quantidade e unidade na transação de aceite. Para negociações anteriores com pedido financeiro, a migração usa o total, a quantidade e a unidade do pedido. Para as demais, usa os campos da proposta e completa o que estiver disponível no anúncio durante a migração. Esse preenchimento não reconstrói o estado histórico do anúncio. Aplique a migração antes de publicar o frontend correspondente.

A migração [`20261122006000`](../supabase/migrations/20261122006000_pin_proposal_unit.sql) guarda a unidade exibida ao comprador no envio da proposta. O aceite só reserva o lote com a mesma unidade. Propostas antigas ainda abertas ficam no histórico e precisam ser reenviadas para aceitar. Aplique a migração antes do frontend correspondente e atualize abas abertas para usar o formulário novo.

O [financeiro](finance.md) usa os vínculos de negociação existentes e guarda a cotação em centavos no PostgreSQL. A função Supabase `finance` cria a sessão Stripe e concilia o pagamento. O navegador monta o formulário Stripe.js para o comprador autenticado e consulta os estados autorizados.

## Controles de segurança e ordem de implantação

Aplique as migrações de `20261122007000` a `20261122010000` em ordem antes de publicar o frontend correspondente. Publique a Edge Function `finance` junto com a versão compatível da migração de MFA. A versão anterior da função deixa de executar ações financeiras administrativas quando o banco passa a exigir `aal2`.

- Habilite TOTP no Supabase Auth e coordene o cadastro do autenticador das contas administrativas com seus responsáveis. Para novas contas, confirme a configuração do fator antes de conceder o papel administrativo. A confirmação de operações exige uma sessão `aal2`. Revise também o processo de recuperação e revogação de sessões.
- O aceite fixa nome, descrição, categoria, condição e tipo de material na mesma transação que reserva o lote. O preenchimento de registros anteriores usa o nome do pedido financeiro quando existe e os demais dados disponíveis no anúncio durante a migração. Detalhes históricos anteriores podem divergir.
- Os arquivos de produto usam links assinados. O bucket `produtos` aceita até 5 MB por arquivo em PDF, JPEG, PNG ou WebP. URLs externas antigas deixam de abrir. Comprovantes financeiros ficam visíveis a quem enviou e à administração com MFA antes do vínculo. Os participantes autorizados têm acesso depois do registro do envio ou estorno. A limpeza de comprovantes órfãos deve usar a API do Storage e um prazo de retenção definido pela operação.
- Antes de aplicar a migração de CNPJ, confira possíveis duplicatas entre empresas já verificadas após normalizar letras, números e pontuação. A aprovação mantém um CNPJ normalizado por empresa verificada. Cadastros pendentes podem compartilhar o número. O administrador deve conferir o CNPJ e a representação da empresa antes de aprovar.
- O chat só abre uma conversa nova por par e anúncio disponível. Cada conta pode enviar até 30 mensagens por minuto, com até 4.000 caracteres por mensagem. Cada conta pode registrar até 10 denúncias por hora, com até 2.000 caracteres por denúncia. O mesmo denunciante só pode ter uma denúncia em andamento por alvo.

Os endpoints PHP em `legacy/` respondem com HTTP 410 e ficam fora do pacote do Vite. Confira na hospedagem se versões anteriores dessas rotas também foram retiradas.

Use o [grafo local](../graphify-out/GRAPH_REPORT.md) como índice de navegação e confirme os detalhes no código.
