# Revisão de privacidade e conteúdo

Estado: revisão estática do repositório em 21/11/2026. A confirmação da operação e a validação em homologação estão pendentes.

## Itens confirmados no projeto

- Cadastro exige nome da empresa, CNPJ, e-mail e senha; campos de perfil e endereço podem ser adicionados depois.
- Supabase Auth, banco de dados e Storage processam os dados centrais do produto.
- A busca de endereço chama ViaCEP ao sair do campo CEP.
- Sessão de autenticação e tema usam armazenamento local do navegador.
- Não há Google Analytics, pixels de anúncio, scripts de rastreamento ou checkout no código revisado.
- Fontes foram empacotadas no site. Fotos de equipe na raiz não são referenciadas pela interface atual.
- Avaliações são publicadas por empresas cadastradas, mas não estão vinculadas a transação confirmada.
- O texto público não contém métricas ambientais ou depoimentos inventados no código revisado.
- A política RLS antiga permitia trocar participantes da conversa e abrir histórico alheio. A nova migração remove essa escrita; aplique-a no Supabase conectado antes de considerar o banco corrigido.
- A opção `privacy_profile` não era aplicada às consultas. Uma função RLS agora oculta perfis e anúncios de empresas que desativam a visibilidade. A migração está pendente no ambiente conectado.
- O banco anterior tratava o bucket `produtos` como público. A migração de 21/11 mantém os objetos no mesmo lugar, torna o bucket privado e condiciona a assinatura de URLs à visibilidade do perfil ou anúncio. Links assinados duram cinco minutos. Revogar o acesso não apaga cópias já baixadas.
- A mesma migração restringe a leitura direta de CNPJ, e-mail, telefone, endereço e CEP no diretório de empresas. O titular acessa seu próprio cadastro e a listagem administrativa exige administrador ativo. O cadastro novo aproveita os metadados de confirmação do Supabase Auth, sem nova cópia de dados cadastrais em armazenamento local.
- Contas comuns passam a cancelar negociações pelo fluxo existente, com histórico, e perdem a permissão de apagá-las diretamente ou inserir registros de atividade. Denúncias entram como pendentes.

## Rascunho de políticas

### Privacidade e LGPD

Descrever cadastro, perfil, anúncios, mensagens, negociações, favoritos, avaliações, denúncias, notificações e dados técnicos. Explicar cada finalidade, base legal, operadores, transferências internacionais, segurança, retenção e canal para direitos. O código não determina bases legais, região do Supabase, retenção ou rotina completa de exclusão; não inventar esses detalhes.

### Cookies e rastreamento

Não há rastreadores opcionais no código revisado. O armazenamento local mantém sessão e tema. Não mostrar banner de consentimento fictício. Reavaliar antes de ativar medição ou publicidade.

### Termos de uso

Descrever a plataforma como espaço de cadastro, publicação, comunicação e negociação B2B. Definir regras de conta, conteúdo, imagens, alegações ambientais, moderação, disponibilidade, disputas, encerramento da conta, leis aplicáveis e foro. Confirmar a operação real antes de publicar.

### Pagamentos e reembolsos

O código não implementa pagamento nem checkout. Confirmar se existe cobrança fora do site. Se existir, identificar quem cobra, taxas, cancelamento, prazos e canal de suporte.

## Dados que o responsável precisa fornecer

1. Razão social, CNPJ e endereço da pessoa jurídica responsável.
2. E-mail de privacidade e nome/canal do encarregado, se aplicável.
3. Região e configuração do projeto Supabase, retenção e backups.
4. Procedimento real para acesso, correção, portabilidade, bloqueio, exclusão e encerramento de conta.
5. Confirmação sobre taxas, pagamentos, reembolsos, entregas e disputas tratados fora do app.
6. Confirmação dos direitos de uso do logo e dos materiais visuais.
7. Aprovação jurídica final das políticas e do foro.

## Obrigações a confirmar com a operação

- **LGPD:** definir finalidades, bases legais e retenção por categoria. Identificar a controladora, conferir o canal de direitos e o responsável por pedidos, confirmar região, subprocessadores e salvaguardas de transferência internacional. Preparar registro das operações e procedimento de incidentes. [LGPD, arts. 6º a 9º, 18, 33, 37, 41, 46 e 48](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm) · [Transferências internacionais](https://www.gov.br/anpd/pt-br/assuntos/assuntos-internacionais/transferencia-internacional-de-dados) · [Comunicação de incidentes](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis)
- **Registros de acesso:** se a operadora se enquadrar no art. 15, confirmar com a hospedagem a guarda sigilosa por seis meses dos registros de acesso à aplicação. O histórico de atividade do produto tem outra finalidade. [Marco Civil da Internet](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm)
- **Contratação:** confirmar se há oferta ou contratação de consumo, inclusive no plano ou nas taxas da própria plataforma. Quando aplicável, publicar identificação do fornecedor, condições da oferta e mecanismos de atendimento e arrependimento. [Código de Defesa do Consumidor](https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm) · [Decreto 7.962/2013](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm)
- **Resíduos:** confirmar a classificação dos materiais e o papel de cada participante. A operação pode exigir licenças, PGRS, MTR e comprovação de destinação. [Política Nacional de Resíduos Sólidos](https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/lei/l12305.htm) · [MTR no SINIR](https://sinir.gov.br/sistemas/mtr/)
- **Acessibilidade:** validar os fluxos públicos e autenticados em teclado, leitor de tela e diferentes tamanhos de tela. A inspeção estática desta revisão cobre os elementos alterados. [Lei Brasileira de Inclusão, art. 63](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm#art63)

## Implantação e verificação

Banco existente e frontend precisam ser atualizados na mesma janela, depois de validar a migração `20261121120000_minimize_company_data_and_protect_media.sql` sobre as migrações anteriores em homologação. Bancos novos podem usar o `schema.sql` consolidado. O frontend novo depende das funções e permissões novas. Verifique versões antigas do frontend que possam permanecer no cache.

Em instância descartável e isolada, use empresas fictícias com perfis visíveis e ocultos, uma conta suspensa e um administrador. Confirme cadastro, leitura do próprio perfil, listagem administrativa, acesso a imagens e documentos vinculados, bloqueio de URLs públicas antigas, denúncias e cancelamento com histórico. Na hospedagem, confira sessões, políticas efetivas do banco e cache das antigas URLs públicas antes de divulgar a atualização.
