import type { InputHTMLAttributes, ReactNode } from "react";
import styles from "./ui.module.css";

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
}

export function Checkbox({ label, className, ...rest }: CheckboxProps) {
  return (
    <label className={styles.checkboxRow}>
      <input type="checkbox" className={className} {...rest} />
      {label && <span className={styles.checkboxLabel}>{label}</span>}
    </label>
  );
}
