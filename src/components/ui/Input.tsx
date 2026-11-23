import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import styles from "./ui.module.css";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  required?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, hint, icon, className, id, ...rest }, ref) {
    const inputId = id ?? rest.name;

    return (
      <div className={styles.field}>
        {label && (
          <label className={styles.label} htmlFor={inputId}>
            {label}
            {rest.required && <span className={styles.required}>*</span>}
          </label>
        )}

        <div className={icon ? styles.inputWithIcon : undefined}>
          <input
            ref={ref}
            id={inputId}
            className={[
              styles.input,
              error ? styles.inputError : "",
              className ?? "",
            ]
              .filter(Boolean)
              .join(" ")}
            {...rest}
          />
          {icon && <span className={styles.inputIcon}>{icon}</span>}
        </div>

        {error && <span className={styles.errorText}>{error}</span>}
        {!error && hint && <span className={styles.hint}>{hint}</span>}
      </div>
    );
  }
);
