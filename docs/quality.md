# Qualidade e validação

## Comandos

| Comando no PowerShell | Evidência |
| --- | --- |
| `npm.cmd run lint` | Regras Oxlint sobre a aplicação e o código legado. |
| `npm.cmd run build` | Tipos com `tsc -b` e geração do bundle Vite. |
| `npm.cmd run check` | Lint seguido de tipos e build. |
| `npm.cmd audit` e `npm.cmd audit --omit=dev` | Alertas publicados nas dependências do lockfile, separados por escopo. |
| `npm.cmd run dev` | Servidor local para validação no navegador. |

Use `npm.cmd run build -- --outDir <diretório-temporário>` quando precisar preservar o build existente. O projeto ainda carece de uma suíte de testes automatizados. Descreva a prova de regressão de cada mudança e registre o que depende de uma conta ou banco de teste.

## Revisão e recuperação

Para mudanças de sessão, autorização, dados e arquivos, rastreie a entrada, o serviço, a política SQL e a resposta. Valide permissões em um Supabase de teste explícito, com contas fictícias e dados descartáveis. Siga as diretrizes de segurança em [AGENTS.md](../AGENTS.md). Para uma revisão formal, use a skill `security-audit` e o [prompt 13 do Toolkit na revisão adotada](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/7ef68dd7b00ddfc5cd464458855e4ab66dd2128f/docs/prompts/13-security-review.md). Informe a raiz, as fronteiras a revisar e se existe um intervalo Git. A revisão defensiva pode começar por uma leitura pontual de código.

Mudanças não triviais recebem revisão independente quando a sessão tiver um agente disponível. O coordenador reúne as evidências, confere o diff e repete as verificações afetadas. Em caso de regressão, restaure primeiro a configuração específica a partir do backup e repita o comando que falhou. Logs e relatos devem omitir tokens, credenciais e dados pessoais.

## Método Harness2 nativo

Use o [prompt 15 na revisão adotada](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/7ef68dd7b00ddfc5cd464458855e4ab66dd2128f/docs/prompts/15-harness-improvement.md) para diagnosticar um problema observável nas instruções ou nos checks. Registre caso e critério, rode a referência existente, teste um único candidato descartável, compare a evidência e adote a menor melhoria que preservar a cobertura. Mantenha o cliente, autenticação e permissões da sessão. A CLI oficial e benchmarks com API ficam fora do fluxo do projeto.

Em 2026-11-21, o lint de referência passou com 119 avisos. A comparação com `oxlint --ignore-pattern ".agents/skills/**" --format json` excluiu 112 avisos de JavaScript vendorizado. Os 4 avisos do legado e os 3 de Fast Refresh em `src` continuaram visíveis. A configuração local incorporou apenas essa exclusão e preservou as regras.

O build de referência passou. O bundler avisou sobre PostCSS e sobre o bloco da cena 3D acima de 500 kB. A auditoria do registro npm retornou zero alertas, tanto no lockfile completo quanto no recorte de produção. Esses resultados não medem a segurança das políticas SQL nem o comportamento de serviços publicados.

Após a configuração, `npm.cmd run check` passou em uma cópia descartável. O perfil `--type-aware` do Oxlint exige `oxlint-tsgolint`, ausente neste projeto. Mantivemos a checagem de tipos com TypeScript e deixamos o perfil adicional sem ativação.

O Chrome DevTools abriu a home e `/informacoes` em contexto isolado; a home coube nas larguras testadas de 1440 px e 390 px. A navegação direta ao marketplace voltou à home sem sessão. O console ficou sem erros ou avisos nos fluxos verificados. O botão de login ficou desabilitado sem Supabase. Autenticação, escrita de dados, RLS e arquivos precisam de uma instância autorizada de teste para validação dinâmica.

Para repetir a verificação integrada do Toolkit, siga o [guia de avaliação](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/7ef68dd7b00ddfc5cd464458855e4ab66dd2128f/docs/07-harness-evaluation.md). Anote instruções encontradas, skills descobertas, consulta ao Context7, consulta ao grafo, estado do RTK e os fluxos locais observados. Registre como pendente qualquer teste que precise de um serviço ou de uma aprovação.

## Busca, anúncios e negociações

- No marketplace, aplique busca, filtros e ordenação, passe de página, abra um anúncio e volte pelo navegador e pelo link do anúncio. Confira a mesma seleção e teste a recuperação de uma página inexistente.
- No editor, altere um campo, tente sair e escolha continuar. Simule falha no envio de uma foto, reenvie e publique. O formulário deve manter os valores durante a recuperação e permitir navegar após salvar.
- Com duas contas fictícias, confira a orientação do comprador e do vendedor. Ao abrir e fechar uma confirmação, o estado deve permanecer igual. Confirme uma ação e verifique uma única atualização. Um serviço simulado verifica a interface, mas a validação de regras de acesso e persistência exige uma instância Supabase de teste autorizada.
- Na home, compare o carregamento do pôster e da cena 3D em largura móvel com rede e CPU limitadas. Em uma execução local de cada build no Chrome a 390 px, Slow 4G e CPU 4×, o pôster passou de terminar durante o download do 3D a terminar antes do início dele. O tamanho do bloco 3D continuou em cerca de 576 kB sem compressão. Com movimento reduzido, houve zero requisições do bloco. A emulação não estabelece um ganho de tempo em aparelho físico.

A execução local com dados fictícios confirmou o retorno à busca, a recuperação de página inválida, o reenvio e a publicação do anúncio, além da recusa com uma única atualização depois de confirmar. A simulação não implementou o Realtime. O ensaio com “aparas” e “retalhos” ilustrou a diferença entre busca literal e sinônimos. Logs de buscas reais não fizeram parte da validação.
