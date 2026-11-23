import type { HTMLAttributes, ReactNode } from "react";
import styles from "./ui.module.css";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
  padding?: "sm" | "md" | "lg";
  title?: string;
}

export function Card({
  children,
  hover = false,
  padding = "md",
  title,
  className,
  ...rest
}: CardProps) {
  const classes = [
    styles.card,
    hover ? styles.cardHover : "",
    padding === "sm" ? styles.cardPaddingSm : padding === "lg" ? styles.cardPaddingLg : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...rest}>
      {title && <h3 className={styles.cardTitle}>{title}</h3>}
      {children}
    </div>
  );
}
