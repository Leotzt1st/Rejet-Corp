import type { ReactNode } from "react";
import styles from "./ui.module.css";

interface LoaderProps {
  text?: string;
  fullPage?: boolean;
  small?: boolean;
  large?: boolean;
}

export function Loader({ text, fullPage = false, small = false, large = false }: LoaderProps) {
  return (
    <div className={`${styles.loaderWrap} ${fullPage ? styles.fullPageLoader : ""}`}>
      <span
        className={`${styles.spinner} ${small ? styles.spinnerSm : ""} ${large ? styles.spinnerLg : ""}`}
      />
      {text && <span>{text}</span>}
    </div>
  );
}

export function PageLoader({ text = "Carregando..." }: { text?: string }) {
  return <Loader text={text} fullPage />;
}

export function SkeletonCard({ children }: { children?: ReactNode }) {
  return <div className={styles.card}>{children ?? null}</div>;
}
