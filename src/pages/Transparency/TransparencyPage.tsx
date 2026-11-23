import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import Footer from "../../components/layout/Footer";
import styles from "./TransparencyPage.module.css";

const DATA_REQUEST_EMAIL =
  "mailto:contato@rejet.com?subject=Solicita%C3%A7%C3%A3o%20de%20dados%20pessoais%20-%20Rejet%20Corp";

export default function TransparencyPage() {
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  useEffect(() => {
    const oldTitle = document.title;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const oldDescription = description?.content;

    document.title = "Dados, uso e regras | Rejet Corp";
    if (description) {
      description.content = "Informações sobre dados pessoais, cookies, serviços integrados e uso da plataforma Rejet Corp.";
    }

    return () => {
      document.title = oldTitle;
      if (description && oldDescription) description.content = oldDescription;
    };
  }, []);

  return (
    <>
      <a className={styles.skipLink} href="#conteudo">
        Pular para o conteúdo
      </a>

      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="Rejet Corp, página inicial">
          <img src="/rejet-mark.png" alt="" aria-hidden="true" width="42" height="42" />
          <span translate="no">Rejet <span className={styles.brandCorp}>Corp</span></span>
        </a>
        <a className={styles.backLink} href="/">Voltar ao início</a>
      </header>

      <main id="conteudo" className={styles.main} tabIndex={-1}>
        <div className={styles.intro}>
          <p className={styles.kicker}>Transparência</p>
          <h1>Dados, uso e regras da plataforma</h1>
          <p className={styles.lede}>
            Saiba quais dados são usados e como solicitar atendimento sobre privacidade.
          </p>
        </div>

        <aside className={styles.notice} role="note" aria-labelledby="status-title">
          <h2 id="status-title">Informações da operadora em confirmação</h2>
          <p>
            A identificação completa da operadora, os prazos de retenção e as condições
            comerciais ainda precisam de confirmação.
          </p>
        </aside>

        <nav className={styles.contents} aria-label="Nesta página">
          <a href="#privacidade">Dados pessoais</a>
          <a href="#cookies">Cookies e rastreamento</a>
          <a href="#termos">Uso da plataforma</a>
          <a href="#reembolsos">Pagamentos e reembolsos</a>
          <a href="#terceiros">Serviços integrados</a>
          <a href="#conteudo-publicado">Conteúdo, imagens e avaliações</a>
          <a href="#acessibilidade">Acessibilidade</a>
          <a href="#legislacao">Legislação</a>
          <a href="#empresa">Dados da empresa</a>
        </nav>

        <div className={styles.sections}>
          <section id="privacidade" className={styles.section}>
            <p className={styles.sectionIndex}>Dados pessoais</p>
            <h2>O que o site usa</h2>
            <p>
              O cadastro pede nome da empresa, CNPJ, e-mail corporativo e senha. O perfil
              também pode conter telefone, endereço, site, redes sociais, segmento e
              descrição. O uso da plataforma gera dados sobre produtos, imagens, mensagens,
              negociações, favoritos, avaliações, notificações e relatos.
            </p>
            <p>
              Esses dados atendem cadastro, autenticação, publicação de materiais,
              comunicação entre empresas e operação da plataforma. A senha é tratada pelo
              Supabase Auth. O site também guarda sessão e preferência de aparência no
              armazenamento local do navegador.
            </p>
            <p>
              A área de preferências permite ocultar o perfil e os anúncios de outras
              empresas. Os arquivos da plataforma usam links temporários. Os links já emitidos
              podem continuar disponíveis até expirar.
            </p>
            <p>
              Use o canal abaixo para exercer seus direitos, como confirmar o tratamento,
              pedir acesso, corrigir dados ou solicitar bloqueio, portabilidade ou exclusão,
              conforme a LGPD. Informe o tipo de solicitação e o e-mail da conta. Evite enviar
              senhas ou documentos pessoais no primeiro contato.
            </p>
            <a className={styles.actionLink} href={DATA_REQUEST_EMAIL}>
              Enviar solicitação sobre dados pessoais
            </a>
          </section>

          <section id="cookies" className={styles.section}>
            <p className={styles.sectionIndex}>Cookies e rastreamento</p>
            <h2>Armazenamento no navegador</h2>
            <p>
              A aplicação usa o armazenamento local para manter a sessão e lembrar a
              preferência de aparência. A aplicação não inclui rastreadores de publicidade.
            </p>
          </section>

          <section id="termos" className={styles.section}>
            <p className={styles.sectionIndex}>Uso da plataforma</p>
            <h2>Conexão entre empresas</h2>
            <p>
              O produto atual oferece cadastro empresarial, anúncios de materiais,
              mensagens e negociação. O código não contém checkout. Condições de venda,
              entrega, qualidade, pagamento e responsabilidades de cada negócio precisam
              ser acordadas pelas partes e descritas nos Termos de Uso completos.
            </p>
            <p>
              As avaliações são enviadas por empresas cadastradas e não são verificadas por
              transação. Quando a operação envolver resíduos, cada parte deve verificar as
              exigências de licenciamento, transporte e destinação aplicáveis à sua atividade.
            </p>
          </section>

          <section id="reembolsos" className={styles.section}>
            <p className={styles.sectionIndex}>Pagamentos e reembolsos</p>
            <h2>Sem pagamento dentro do site</h2>
            <p>
              O código atual não processa pagamentos e não oferece checkout. Por isso, não
              existe fluxo de reembolso da plataforma implementado. Se houver cobrança ou
              pagamento operado fora do site, a empresa deve informar taxas, responsável,
              prazos e regras de cancelamento antes de publicar a política.
            </p>
          </section>

          <section id="terceiros" className={styles.section}>
            <p className={styles.sectionIndex}>Serviços integrados</p>
            <h2>Para onde o site envia dados</h2>
            <ul>
              <li>
                <strong>Supabase:</strong> autenticação, banco de dados e armazenamento de
                imagens e documentos.
              </li>
              <li>
                <strong>ViaCEP:</strong> recebe o CEP digitado quando o campo perde o foco,
                para sugerir cidade e estado.
              </li>
              <li>
                <strong>Fontes locais:</strong> as fontes visuais agora são empacotadas com
                o site; a página não precisa buscá-las no Google Fonts.
              </li>
            </ul>
            <p>
              O projeto não informa a região de hospedagem do Supabase, os prazos de retenção
              ou os contratos com operadores. A empresa precisa validar esses pontos.
            </p>
          </section>

          <section id="conteudo-publicado" className={styles.section}>
            <p className={styles.sectionIndex}>Conteúdo publicado</p>
            <h2>Imagens, alegações e avaliações</h2>
            <p>
              Ao publicar produtos, use apenas imagens próprias ou autorizadas e dados
              corretos. Evite documentos, rostos e dados pessoais nas fotos. Só publique
              alegações ambientais que a empresa consiga comprovar.
            </p>
            <p>
              As avaliações aparecem com aviso de que não são verificadas por transação. Não
              há depoimentos de marketing fixos no código revisado. As fotos de equipe
              encontradas na pasta do projeto não são usadas pela interface atual.
            </p>
          </section>

          <section id="acessibilidade" className={styles.section}>
            <p className={styles.sectionIndex}>Acessibilidade</p>
            <h2>Revisão do fluxo público</h2>
            <p>
              Esta página oferece navegação por teclado, link para pular ao conteúdo,
              hierarquia de títulos e textos alternativos para conteúdo visual. O restante
              do aplicativo ainda depende de uma verificação em navegador e de dados reais
              para cobrir fluxos autenticados.
            </p>
          </section>

          <section id="legislacao" className={styles.section}>
            <p className={styles.sectionIndex}>Legislação</p>
            <h2>Normas a validar para a operação real</h2>
            <p>
              A LGPD precisa ser considerada no tratamento de dados pessoais. A aplicação do
              Código de Defesa do Consumidor e das regras de comércio eletrônico depende do
              modelo comercial e de quem contrata com quem. A empresa deve confirmar a
              jurisdição, o foro e as normas aplicáveis antes de publicar os Termos de Uso.
            </p>
            <ul>
              <li>
                <a href="https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares" target="_blank" rel="noreferrer">
                  Direitos dos titulares — ANPD
                </a>
              </li>
              <li>
                <a href="https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais" target="_blank" rel="noreferrer">
                  Guia de cookies — ANPD
                </a>
              </li>
            </ul>
          </section>

          <section id="empresa" className={styles.section}>
            <p className={styles.sectionIndex}>Dados da empresa</p>
            <h2>Informações a completar</h2>
            <ul>
              <li>Razão social, CNPJ e endereço da responsável pela plataforma.</li>
              <li>Canal oficial de privacidade e identificação do encarregado, se aplicável.</li>
              <li>Prazo de retenção e procedimento real para apagar conta e dados.</li>
              <li>Regras completas de uso, foro, cobrança, cancelamento e reembolso.</li>
              <li>Confirmação de titularidade das marcas, logos e imagens publicadas.</li>
            </ul>
            <p>
              O rodapé informa <a href="mailto:contato@rejet.com">contato@rejet.com</a> como
              canal atual. Confirme se esse endereço atende solicitações de titulares.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}
