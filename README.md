# Rejet Corp

Plataforma web que conecta empresas que publicam excedentes industriais a empresas que podem reaproveitá-los. O fluxo principal passa por encontrar materiais, publicar ofertas e negociar entre empresas.

## Desenvolvimento local

Use Node 24 e npm. No PowerShell, use os comandos `npm.cmd` quando a política local impedir a execução de `npm.ps1`.

```powershell
npm.cmd ci
npm.cmd run dev
npm.cmd run check
```

A home e as páginas públicas podem ser conferidas sem Supabase. Para configurar autenticação e dados em um ambiente de teste, siga o [guia de desenvolvimento](docs/onboarding.md).

- [Produto e fluxos](PRODUCT.md)
- [Arquitetura e Supabase](docs/architecture.md)
- [Sistema visual](DESIGN.md)
- [Qualidade e validação](docs/quality.md)
- [Configuração do Toolkit](docs/setup.md)
