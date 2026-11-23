# Setup do Vibe Coding Toolkit

Preparação de projeto existente para Codex no Windows em 2026-11-21. Fonte [prompt 12, revisão 7ef68dd](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/7ef68dd7b00ddfc5cd464458855e4ab66dd2128f/docs/prompts/12-existing-project-setup.md). O Superpowers orientou o brainstorming. O usuário aprovou a adaptação após o diagnóstico de React 19, TypeScript 6, Vite 8, Oxlint 1, npm e Supabase.

## Organização

- [README](../README.md) para começar, [PRODUCT](../PRODUCT.md) para o produto e [AGENTS](../AGENTS.md) para instruções curtas.
- [CLAUDE](../CLAUDE.md) importa as instruções comuns para quem já usa Claude Code. A sessão validada é do Codex.
- [Arquitetura](architecture.md), [design](design.md), [onboarding](onboarding.md) e [qualidade](quality.md) detalham responsabilidades. [DESIGN.md](../DESIGN.md) permanece a referência visual.
- Decisões de projeto vivem nesses documentos. Use o grafo como índice derivado, consulte o código para confirmar e atualize o grafo quando módulos ou relações mudarem. Retome uma tarefa longa conferindo arquivos e comandos reais antes de usar notas anteriores.

## Cobertura do catálogo

| Componente | Decisão e evidência |
| --- | --- |
| Superpowers | Plugin global reutilizado. Brainstorming executado com aprovação do usuário. |
| Subagentes | Revisão independente e somente leitura de configurações, documentação inicial e skills. Detectou a licença Supabase ausente na cópia, corrigida em `.agents/`. Selecione por risco e mantenha verificações integradas com o coordenador. |
| RTK | CLI global disponível para uso manual. O hook depende da confiança atribuída em `/hooks` e permanece fora da configuração local. |
| Ponytail e Caveman | Skills globais reaproveitadas. Escopo proporcional e respostas em português. |
| ESLint e Biome | Substituídos pela combinação Oxlint e TypeScript já usada no projeto. Os módulos ESLint do catálogo dependem da API daquele linter. |
| Graphify | CLI 0.9.105 reutilizada. Atualização AST local com exclusões e consulta de rotas. SQL carece do extrator opcional. CSS e arquivos sem extrator ficam fora da cobertura. |
| Obsidian e memória Claude | Documentação versionável para memória do projeto. O índice está no AGENTS. Sem vault ou integração externa nesta configuração. |
| Hooks | Hooks existentes preservados. A instalação não acrescenta hooks locais, Git hooks ou chamadas duplicadas. |
| agent-browser e Chrome DevTools | Chrome DevTools MCP cobre navegação local e console em contexto isolado. agent-browser não foi necessário para o fluxo observado. |
| Context7 | MCP global reutilizado. Consulta real de configuração do Oxlint, sem enviar código do projeto. |
| Anthropic Skills | `frontend-design` global e Impeccable local reaproveitadas. Skills de artefatos sob demanda para tarefas correspondentes. |
| Codex | Cliente principal, com instruções em AGENTS e skills locais em `.agents/skills`. Autenticação e permissões existentes. |
| Vercel web | Set web conferido no upstream. Set local registra oito instalações incluindo PostgreSQL, todas descobertas uma vez por um App Server novo. `web-design-guidelines` e `find-skills` já estavam disponíveis globalmente. Skills de deploy, tokens e otimização ficam à disposição para fluxos autorizados. |
| React Native | Inaplicável à aplicação web. |
| next-dev-loop e next-bundle-optimizer | Inaplicáveis ao Vite. Use DevTools e o relatório do build Vite. |
| Supabase PostgreSQL | `supabase-postgres-best-practices` copiada localmente. A revisão SQL foi estática e não executou migrações. |
| gh-fix-ci | Depende de GitHub Actions e acesso autorizado. A cópia atual não tem metadados Git nem workflow Actions. |
| differential-review | Revisão manual de código e comparação com o backup. A revisão diferencial completa requer um histórico Git com intervalo verificável. |
| shadcn | O projeto usa CSS Modules e componentes próprios. O MCP global pode servir como referência para tarefas de UI no sistema atual. |
| Sentry MCP | Sem serviço ou projeto Sentry selecionado para esta aplicação. |
| Harness2 | Método nativo adotado e comparado no lint. Consulte [qualidade](quality.md). A CLI e o benchmark oficial exigem seleção separada. |

## Atualizar e reproduzir

Para restaurar as skills locais, consulte [skills-lock.json](../skills-lock.json) e [as atribuições](../.agents/THIRD_PARTY_NOTICES.md). Use a CLI oficial `npx skills` quando precisar instalar ou atualizar, confira `--help`, selecione apenas Codex e use cópia portátil no Windows. O catálogo Vercel foi instalado da revisão `5a37a6329fbad3666c3207392a6a7c0110e92efb` e o Supabase da revisão `c9be0e931b7930f7d02126d04774d904c381e7d7`.

Rode `graphify update .` para reconstruir o índice local e `graphify query "AppRoutes.tsx PrivateRoute AuthContext" --budget 300` para verificar a navegação. Consulte `.graphifyignore` antes de indexar novos diretórios. A extração AST não precisa de um provedor de modelos.

Para reaplicar este setup, leia esta matriz e o prompt versionado, faça backup local dos arquivos que vai alterar, repita as verificações em [qualidade](quality.md) e atualize documentação e skills apenas onde o estado observado exigir. A cópia original das configurações e do grafo anterior foi guardada fora do projeto antes da troca.
