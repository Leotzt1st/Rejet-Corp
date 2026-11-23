import type { InputHTMLAttributes } from "react";
import styles from "./ui.module.css";

interface SwitchProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Switch({ label, className, ...rest }: SwitchProps) {
  return (
    <label className={styles.switchRow}>
      {label && <span className={styles.switchLabel}>{label}</span>}
      <span className={styles.switch}>
        <input type="checkbox" className={className} {...rest} />
        <span className={styles.slider} />
      </span>
    </label>
  );
}
