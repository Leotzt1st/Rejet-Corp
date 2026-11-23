import { useEffect, useRef, useState, type MouseEvent } from "react";
import { FiTruck } from "react-icons/fi";
import { LuFactory, LuRecycle } from "react-icons/lu";
import type { renderScene } from "./renderScene";
import styles from "./IndustrialScene.module.css";

const companies = [
  ["Origem do material", "30%", "8%"],
  ["Reaproveitamento e novo uso", "70%", "10%"],
  ["Nova demanda de material", "71%", "53%"],
  ["Novo destino e reinício do ciclo", "30%", "55%"],
] as const;

export default function IndustrialScene() {
  const host = useRef<HTMLDivElement>(null);
  const poster = useRef<HTMLImageElement>(null);
  const viewport = useRef<HTMLCanvasElement>(null);
  const [selected, setSelected] = useState("");

  useEffect(() => {
    const root = host.current;
    const canvas = viewport.current;
    if (!root || !canvas) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 740px)").matches;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    let scene: ReturnType<typeof renderScene> | undefined;
    let cancelled = false;
    let loading = false;
    function fallback() {
      if (!cancelled && root) root.dataset.sceneState = "fallback";
    }
    async function loadScene() {
      if (loading || scene || motion.matches || connection?.saveData) return;
      loading = true;
      try {
        if (mobile && poster.current) await poster.current.decode().catch(() => undefined);
        if (cancelled || motion.matches) return;
        const { renderScene: mount } = await import("./renderScene");
        if (!cancelled && !motion.matches && root && canvas) {
          scene = mount(canvas, root, fallback);
          observer.disconnect();
        }
      } catch {
        observer.disconnect();
        fallback();
      } finally {
        loading = false;
      }
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void loadScene();
    }, { rootMargin: mobile ? "0px" : "140px" });
    function onMotionChange() {
      if (!motion.matches && !scene && root) {
        observer.unobserve(root);
        observer.observe(root);
      }
    }
    if (!connection?.saveData) observer.observe(root);
    motion.addEventListener("change", onMotionChange);
    return () => {
      cancelled = true;
      observer.disconnect();
      motion.removeEventListener("change", onMotionChange);
      scene?.dispose();
    };
  }, []);

  function toggle(event: MouseEvent<HTMLButtonElement>, key: string) {
    if (event.detail === 0 || window.matchMedia("(hover: none)").matches) {
      setSelected((current) => current === key ? "" : key);
    }
  }

  return (
    <div className={styles.scene} ref={host} role="group" aria-label="Circuito de reaproveitamento"
      onKeyDown={(event) => {
        if (event.key === "Escape") setSelected("");
      }}
    >
      <picture className={styles.poster} aria-hidden="true">
        <source media="(max-width: 740px)" srcSet="/industrial-poster-mobile.webp" width={390} height={388} />
        <img ref={poster} src="/industrial-poster.webp" alt="" width={1896} height={512} fetchPriority="high" />
      </picture>
      <canvas ref={viewport} className={styles.canvas} aria-hidden="true" />
      {companies.map(([role, left, top], i) => (
        <button type="button" key={role} className={styles.company} data-scene-pin={i + 1}
          style={{ left, top }} aria-label={`Empresa ${i + 1}: ${role}`}
          data-selected={selected === role} onClick={(event) => toggle(event, role)}
        >
          <span className={styles.label} aria-hidden="true">
            <LuFactory /><span><strong>Empresa {i + 1}</strong><small>{role}</small></span>
          </span>
        </button>
      ))}
      {companies.map(([role], i) => (
        <button type="button" key={role} className={styles.station} data-scene-pin
          aria-label={`Empresa ${i + 1}: coleta e preparo do material`}
          data-selected={selected === `station-${i}`} onClick={(event) => toggle(event, `station-${i}`)}
        >
          <span className={styles.label} aria-hidden="true">
            <LuRecycle /><span>Coleta e preparo do material</span>
          </span>
        </button>
      ))}
      <button type="button" className={styles.transport} data-transport aria-label="Transporte entre empresas"
        data-selected={selected === "truck"} onClick={(event) => toggle(event, "truck")}
      >
        <span className={styles.label} aria-hidden="true">
          <FiTruck /><span>Transporte entre empresas</span>
        </span>
      </button>
    </div>
  );
}
