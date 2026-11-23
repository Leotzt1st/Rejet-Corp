# Desenvolvimento local

Na raiz do projeto, execute `npm.cmd ci` para reproduzir o lockfile. Use `npm.cmd run dev` e abra o endereço local informado pelo Vite. Execute `npm.cmd run check` para validar.

Para conferir as rotas públicas, inicie sem configuração Supabase. Para usar login, cadastro, materiais e negociações, configure uma instância Supabase de teste autorizada em `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://seu-projeto-de-teste.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publicavel
```

Reinicie o servidor após salvar o arquivo. Mantenha a chave de serviço fora do front-end e use dados fictícios. Variáveis prefixadas com `VITE_` podem aparecer no bundle. Aplique migrações somente após conferir o ambiente e a ordem. Consulte a [arquitetura](architecture.md) e a [rotina de validação](quality.md).
