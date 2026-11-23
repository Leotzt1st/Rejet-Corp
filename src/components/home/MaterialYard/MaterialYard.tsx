import { useEffect, useId, useRef, useState } from "react";
import { FiRefreshCw } from "react-icons/fi";

import YardArtwork from "./YardArtwork";
import styles from "./MaterialYard.module.css";

const stages = [
  {
    index: 0,
    label: "Origem",
    title: "Aparas de papel",
    description: "Uma gráfica separa as sobras de corte e anuncia o material disponível.",
    x: 128,
    y: 99,
  },
  {
    index: 1,
    label: "Triagem",
    title: "Papel separado e prensado",
    description: "A triagem retira impurezas. O papel limpo é prensado em fardos para transporte.",
    x: 293,
    y: 125,
  },
  {
    index: 2,
    label: "Novo uso",
    title: "Novas embalagens",
    description: "Uma fábrica compra os fardos e usa as fibras recuperadas para produzir embalagens.",
    x: 444,
    y: 86,
  },
] as const;

export default function MaterialYard() {
  const [activeStage, setActiveStage] = useState<0 | 1 | 2>(0);
  const [run, setRun] = useState(0);
  const sceneRef = useRef<HTMLDivElement>(null);
  const detailId = useId();
  const stage = stages[activeStage];

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || run > 0 || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      if (window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
        setRun((currentRun) => Math.max(1, currentRun));
      }
    }, { threshold: 0.55 });

    observer.observe(scene);
    return () => observer.disconnect();
  }, [run]);

  return (
    <>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Exemplo de reaproveitamento</p>
          <h2>O caminho do papel</h2>
        </div>
        <button
          type="button"
          className={styles.replay}
          aria-label="Repetir percurso do carrinho"
          title="Repetir percurso"
          onClick={() => setRun((currentRun) => currentRun + 1)}
        >
          <FiRefreshCw aria-hidden="true" />
        </button>
      </div>

      <p className={styles.guide}>Selecione uma etapa para acompanhar o material.</p>

      <div className={styles.scene} ref={sceneRef} role="group" aria-label="Etapas do reaproveitamento">
        <YardArtwork activeStage={activeStage}>
          {run > 0 && (
            <g className={styles.cart} key={run}>
              <ellipse cy="6" rx="17" ry="7" fill="#090c0a" opacity=".7" />
              <path d="M-15 1v5l10 6L16 0v-5" fill="#507715" stroke="#0c1307" />
              <path d="m-15 1 21-12 10 6L-5 7Z" fill="#dcff81" stroke="#172609" />
              <path d="m-8-3 9-5 8 5L0 2Z" fill="#f5f4da" />
              <path d="M-8-3v-5l8 5v5Zm8 0 9-5v5L0 2Z" fill="#b4c48e" />
              <path d="m-8-8 9-5 8 5-9 5Z" fill="#ecefd4" />
            </g>
          )}
        </YardArtwork>

        {stages.map(({ index, label, x, y }) => (
          <button
            key={label}
            type="button"
            className={styles.pin}
            style={{ left: `${x / 560 * 100}%`, top: `${y / 340 * 100}%` }}
            aria-pressed={index === activeStage}
            aria-controls={detailId}
            onClick={() => setActiveStage(index)}
          >
            <span className={styles.pinNumber} aria-hidden="true">0{index + 1}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className={styles.detail} id={detailId} aria-live="polite" aria-atomic="true">
        <span className={styles.detailNumber} aria-hidden="true">0{stage.index + 1}</span>
        <div className={styles.detailCopy}>
          <h3>{stage.title}</h3>
          <p>{stage.description}</p>
        </div>
      </div>
    </>
  );
}
