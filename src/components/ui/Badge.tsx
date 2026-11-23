import type { ReactNode } from "react";
import styles from "./ui.module.css";

type BadgeVariant = "primary" | "secondary" | "success" | "danger" | "warning" | "neutral";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = "neutral", children, className }: BadgeProps) {
  const classes = [
    styles.badge,
    styles[`badge${variant.charAt(0).toUpperCase()}${variant.slice(1)}`],
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return <span className={classes}>{children}</span>;
}
