# Rejet Corp

- Leia [PRODUCT.md](PRODUCT.md) para entender o produto e [docs/architecture.md](docs/architecture.md) antes de alterar fronteiras.
- Use npm e preserve o lockfile. Execute `npm run check` para lint, tipos e build. Consulte [docs/onboarding.md](docs/onboarding.md) para rodar localmente e [docs/quality.md](docs/quality.md) para validar.
- Defina o comportamento esperado e a prova antes de editar. Registre falhas anteriores, decisões e limites da validação. Atualize a documentação responsável quando contratos ou comandos mudarem.
- Consulte [docs/setup.md](docs/setup.md) para skills e ferramentas. Use Graphify para orientar buscas e confirme no código. Para mudanças não triviais, peça revisão independente quando disponível e valide o resultado integrado.

## Direção visual

- Antes de criar ou redesenhar uma interface, leia a skill `frontend-design` e defina uma direção visual própria para a Rejet Corp.
- Baseie as escolhas no trabalho da empresa com resíduos, reaproveitamento e economia circular. Evite layouts, paletas, cartões e animações genéricos.
- Use componentes shadcn ou 21st.dev quando resolverem uma necessidade real. Adapte-os aos estilos e às dependências existentes; não migre o projeto de CSS sem necessidade.

## Revisão antes de concluir

- Depois de alterar a interface, aplique a skill `web-design-guidelines` ao código alterado e corrija os problemas encontrados.
- Quando o servidor local estiver disponível, use Chrome DevTools MCP para conferir a página em desktop e celular, observar erros no console e validar os fluxos tocados.
- Corrija problemas visuais e funcionais observados e repita a conferência até a página ficar consistente.
- Relate qualquer bloqueio que impeça uma conferência real, como falta de configuração de serviço ou navegador.

## Segurança

- Em pedidos de segurança, use a skill `security-audit` instalada no Codex. Ela faz revisão defensiva baseada no código e não altera o projeto por conta própria.
- Para dúvidas ou revisões focadas, use apenas as partes relevantes da skill. Faça a auditoria completa somente quando o usuário pedir auditoria, teste de segurança ou relatório completo.
- Não teste serviços publicados nem dados reais. Execute código do projeto para validação de segurança somente se o ambiente oferecer o sandbox isolado exigido pela skill; se não oferecer, registre o bloqueio e proponha validação segura.
