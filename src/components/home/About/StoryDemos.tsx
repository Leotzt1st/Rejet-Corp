import type { ReactNode } from "react";
import { FiArrowRight, FiBox, FiCheck, FiMessageCircle, FiSearch, FiSliders } from "react-icons/fi";
import styles from "./About.module.css";

const materials = [
  { name: "Tubos de aço carbono", type: "Metais", photo: "/story-aco.webp" },
  { name: "Polímero reprocessado", type: "Plásticos", photo: "/story-polimero.webp" },
  { name: "Papel kraft", type: "Papel e papelão", photo: "/story-kraft.webp" },
] as const;

function Photo({ photo, name }: (typeof materials)[number]) {
  return <img className={styles.photo} src={photo} alt={name} width={320} height={235} loading="lazy" decoding="async" />;
}

function Demo({ children, kind }: { children: ReactNode; kind: "publish" | "search" | "conversation" }) {
  return (
    <figure className={`${styles.illustration} ${styles[kind]}`}>
      <img className={styles.scenery} src="/story-patio.webp" alt="" width={960} height={640}
        loading="lazy" decoding="async" />
      <figcaption className={styles.caption}>Demonstração ilustrativa</figcaption>
      {children}
    </figure>
  );
}

function PanelHeader({ children }: { children: ReactNode }) {
  return (
    <div className={styles.panelHeader}>
      <img src="/rejet-mark.png" alt="" width={25} height={25} loading="lazy" />
      <strong>{children}</strong>
    </div>
  );
}

function Outcome({ children }: { children: ReactNode }) {
  return <p className={styles.outcome}><FiCheck aria-hidden="true" /> {children}</p>;
}

export function PublishMaterialDemo() {
  return (
    <Demo kind="publish">
      <div className={styles.laptop}>
        <div className={styles.panel}>
          <PanelHeader>Publicar excedente</PanelHeader>
          <div className={styles.formPreview}>
            <Photo {...materials[0]} />
            <dl className={styles.fields}>
              <div><dt>Material</dt><dd>Tubos de aço carbono</dd></div>
              <div><dt>Quantidade</dt><dd>12.000 kg</dd></div>
              <div><dt>Condição</dt><dd>Bom estado</dd></div>
              <div><dt>Disponibilidade</dt><dd>Imediata</dd></div>
            </dl>
          </div>
          <span className={styles.action}>Publicar excedente <FiArrowRight aria-hidden="true" /></span>
        </div>
      </div>
      <Outcome>Excedente publicado!</Outcome>
    </Demo>
  );
}

export function MaterialSearchDemo() {
  return (
    <Demo kind="search">
      <div className={styles.panel}>
        <PanelHeader>Buscar materiais</PanelHeader>
        <p className={styles.searchField}><FiSearch aria-hidden="true" /> Materiais industriais</p>
        <div className={styles.filters}>
          <FiSliders aria-hidden="true" /><span>Categoria</span><span>Condição</span><span>Localização</span>
        </div>
        <ul className={styles.materials} aria-label="Exemplos de materiais">
          {materials.map((material, index) => (
            <li className={index === 0 ? styles.featured : undefined} key={material.name}>
              <Photo {...material} />
              <strong>{material.name}</strong><small>{material.type}</small>
            </li>
          ))}
        </ul>
      </div>
      <Outcome>Oportunidade encontrada: tubos de aço</Outcome>
    </Demo>
  );
}

export function NegotiationDemo() {
  return (
    <Demo kind="conversation">
      <div className={styles.panel}>
        <PanelHeader>Negociação de material</PanelHeader>
        <div className={styles.participants}>
          <span>Empresa 1 <small>Origem do material</small></span>
          <FiMessageCircle aria-hidden="true" />
          <span>Empresa 2 <small>Interessada</small></span>
        </div>
        <ol className={styles.messages} aria-label="Exemplo de conversa">
          <li><strong>Empresa 2</strong><p>Os tubos de aço ainda estão disponíveis?</p></li>
          <li><strong>Empresa 1</strong><p>Sim. Temos 12 toneladas. Podemos combinar a retirada?</p></li>
        </ol>
        <div className={styles.materialNote}>
          <FiBox aria-hidden="true" /><p><strong>Tubos de aço carbono</strong><small>12.000 kg • Bom estado • SP</small></p>
        </div>
      </div>
      <Outcome>Negociação iniciada</Outcome>
    </Demo>
  );
}
