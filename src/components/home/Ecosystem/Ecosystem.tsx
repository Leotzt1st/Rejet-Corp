import { useEffect, useRef, useState, type CSSProperties } from "react";
import { FiArrowUpRight } from "react-icons/fi";
import { LuHandshake, LuLayers3, LuRecycle } from "react-icons/lu";
import styles from "./Ecosystem.module.css";

const industries = [
  { name: "Papel e embalagens", image: "papel", path: "M 50 53 C 35 51 36 36 19 35" },
  { name: "Metalúrgica", image: "metal", path: "M 50 53 C 64 51 65 33 81 35" },
  { name: "Têxtil", image: "textil", path: "M 50 53 C 35 55 37 76 19 77" },
  { name: "Materiais industriais", image: "materiais", path: "M 50 53 C 65 56 63 76 81 77" },
] as const;

const benefits = [
  { title: "Menos descarte", copy: "Materiais excedentes podem encontrar novos destinos produtivos.", Icon: LuRecycle },
  { title: "Mais aproveitamento", copy: "Recursos disponíveis podem retornar a processos industriais.", Icon: LuLayers3 },
  { title: "Novos negócios", copy: "Conexões entre empresas podem gerar oportunidades comerciais.", Icon: LuHandshake },
] as const;

function Network() {
  return (
    <figure className={styles.network} id="empresas">
      <div className={styles.landscape} aria-hidden="true">
        <img src="/eco-vale.webp" alt="" width={1440} height={810} loading="lazy" decoding="async" />
      </div>
      <svg className={styles.connections} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {industries.map(({ image, path }, index) => (
          <g key={image} style={{ "--connect-at": `${1.2 + index * 0.18}s` } as CSSProperties}>
            <path className={styles.connection} pathLength="100" d={path} />
            <path className={styles.signal} pathLength="100" d={path} />
          </g>
        ))}
      </svg>
      <div className={styles.hub}>
        <img src="/rejet-mark.png" alt="" width={56} height={56} loading="lazy" />
        <strong translate="no">Rejet Corp</strong>
        <span>Plataforma</span>
      </div>
      <ul className={styles.industries} aria-label="Setores ilustrados">
        {industries.map(({ name, image }) => (
          <li key={image} className={styles.industry}>
            <img src={`/eco-${image}.webp`} alt="" width={512} height={512} loading="lazy" decoding="async" />
            <span>{name}</span>
          </li>
        ))}
      </ul>
      <figcaption className={styles.caption}>Rede comercial ilustrativa</figcaption>
    </figure>
  );
}

interface Props {
  onAccess: () => void;
  disabled: boolean;
}

export default function Ecosystem({ onAccess, disabled }: Props) {
  const section = useRef<HTMLElement>(null);
  const [started, setStarted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const root = section.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    let inView = false;
    function syncVisibility() {
      setVisible(inView && !document.hidden);
      if (inView && !document.hidden) setStarted(true);
    }
    const observer = new IntersectionObserver(([entry]) => {
      inView = Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.2);
      syncVisibility();
    }, { threshold: 0.2 });
    observer.observe(root);
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, []);

  return (
    <section id="impacto" className={styles.section} ref={section} aria-labelledby="impacto-titulo"
      data-started={started} data-running={visible}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <p className={styles.kicker}>Ecossistema conectado</p>
          <h2 id="impacto-titulo">Impacto na cadeia produtiva</h2>
          <p>Quando um excedente volta à produção, ele pode substituir matéria-prima nova e evitar descarte. O benefício depende do material, do transporte e do processamento.</p>
        </header>
        <div className={styles.sceneWrap}>
          <Network />
        </div>
        <p className={styles.connectionCopy}>Conectando empresas. Criando oportunidades.</p>
        <ul className={styles.benefits}>
          {benefits.map(({ title, copy, Icon }, index) => (
            <li key={title} style={{ "--benefit-at": `${2.3 + index * 0.35}s` } as CSSProperties}>
              <Icon aria-hidden="true" />
              <div><h3>{title}</h3><p>{copy}</p></div>
            </li>
          ))}
        </ul>
        <p className={styles.networkCopy}>O futuro dos materiais é conectado.</p>

        <div className={styles.cta}>
          <div>
            <p className={styles.kicker}>Economia circular, entre empresas.</p>
            <h3>Dê ao excedente um próximo destino.</h3>
            <p>Conecte sua empresa a uma rede que transforma materiais parados em novas possibilidades de negócio.</p>
          </div>
          <button type="button" onClick={onAccess} disabled={disabled}>
            Acessar plataforma <FiArrowUpRight aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
