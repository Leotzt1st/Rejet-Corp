import { FiArrowRight, FiPlay } from "react-icons/fi";
import IndustrialScene from "../IndustrialScene/IndustrialScene";
import styles from "./Hero.module.css";

interface HeroProps {
  onRegister: () => void;
  demoMode: boolean;
}

export default function Hero({ onRegister, demoMode }: HeroProps) {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.copy}>
        <p className={styles.kicker}>Plataforma de gestão de excedentes industriais</p>
        <h1 id="hero-title">Excedentes industriais <em>em novo ciclo.</em></h1>
        <p className={styles.description}>
          A <span translate="no">Rejet Corp</span> conecta empresas que possuem excedentes de materiais
          a outras que podem reaproveitá-los, para abrir novas possibilidades de uso.
        </p>
        <div className={styles.actions}>
          <button type="button" disabled={demoMode} onClick={onRegister}>
            Cadastre sua empresa <FiArrowRight aria-hidden="true" />
          </button>
          <a href="#empresa"><span><FiPlay aria-hidden="true" /></span> Ver como funciona</a>
        </div>
      </div>
      <IndustrialScene />
    </section>
  );
}
