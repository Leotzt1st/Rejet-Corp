import { useEffect, useRef } from "react";
import { MaterialSearchDemo, NegotiationDemo, PublishMaterialDemo } from "./StoryDemos";
import styles from "./About.module.css";

const stages = [
  {
    id: "publique",
    number: "01",
    title: "Publique o excedente",
    description: "Apresente o material, suas condições e a disponibilidade para negociação.",
    Demo: PublishMaterialDemo,
  },
  {
    id: "encontre",
    number: "02",
    title: "Encontre um novo uso",
    description: "Explore materiais que podem atender às necessidades da sua operação.",
    Demo: MaterialSearchDemo,
  },
  {
    id: "negocie",
    number: "03",
    title: "Negocie entre empresas",
    description: "Converse com outras empresas para definir os próximos passos.",
    Demo: NegotiationDemo,
  },
];

export default function About({ visit = 0 }: { visit?: number }) {
  const intro = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = intro.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!visit || !header || reduced.matches) return;

    let animations: Animation[] = [];
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting || entry.intersectionRatio < 0.5) return;
      observer.disconnect();
      if (reduced.matches) return;
      animations = [...header.querySelectorAll("p, h2")].map((element, index) =>
        element.animate(
          [{ opacity: 0.18, transform: "translateY(9px)" }, { opacity: 1, transform: "translateY(0)" }],
          { duration: 420, delay: index * 100, easing: "ease-out", fill: "backwards" },
        ),
      );
    }, { threshold: 0.5 });
    const cancel = () => animations.forEach((animation) => animation.cancel());
    observer.observe(header);
    reduced.addEventListener("change", cancel);
    return () => {
      observer.disconnect();
      reduced.removeEventListener("change", cancel);
      cancel();
    };
  }, [visit]);

  return (
    <section className={styles.section} aria-labelledby="como-funciona" id="empresa">
      <header ref={intro} className={styles.intro}>
        <div>
          <p className={styles.kicker}>Como funciona</p>
          <h2 id="como-funciona">O material segue em movimento.</h2>
        </div>
        <p>Uma ponte entre empresas que têm excedentes e operações que podem dar a esses materiais um novo uso.</p>
      </header>

      <ol className={styles.timeline}>
        {stages.map(({ id, number, title, description, Demo }) => (
          <li className={styles.step} key={id} id={id}>
            <span className={styles.marker} aria-hidden="true">{number}</span>
            <div className={styles.copy}>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
            <Demo />
          </li>
        ))}
      </ol>
    </section>
  );
}
