import { forwardRef, type SelectHTMLAttributes } from "react";
import styles from "./ui.module.css";

interface Option {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options?: Option[];
  placeholder?: string;
  required?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    { label, error, hint, options = [], placeholder, className, id, children, ...rest },
    ref
  ) {
    const selectId = id ?? rest.name;

    return (
      <div className={styles.field}>
        {label && (
          <label className={styles.label} htmlFor={selectId}>
            {label}
            {rest.required && <span className={styles.required}>*</span>}
          </label>
        )}

        <select
          ref={ref}
          id={selectId}
          className={[
            styles.select,
            error ? styles.inputError : "",
            className ?? "",
          ]
            .filter(Boolean)
            .join(" ")}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
          {children}
        </select>

        {error && <span className={styles.errorText}>{error}</span>}
        {!error && hint && <span className={styles.hint}>{hint}</span>}
      </div>
    );
  }
);
