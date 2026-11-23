import { forwardRef, type TextareaHTMLAttributes } from "react";
import styles from "./ui.module.css";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, error, hint, className, id, ...rest }, ref) {
    const textareaId = id ?? rest.name;

    return (
      <div className={styles.field}>
        {label && (
          <label className={styles.label} htmlFor={textareaId}>
            {label}
            {rest.required && <span className={styles.required}>*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          className={[
            styles.textarea,
            error ? styles.inputError : "",
            className ?? "",
          ]
            .filter(Boolean)
            .join(" ")}
          {...rest}
        />

        {error && <span className={styles.errorText}>{error}</span>}
        {!error && hint && <span className={styles.hint}>{hint}</span>}
      </div>
    );
  }
);
