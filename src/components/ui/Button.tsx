import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import styles from "./ui.module.css";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  to?: string;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  block = false,
  to,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    styles.btn,
    styles[`btn${variant.charAt(0).toUpperCase()}${variant.slice(1)}`],
    styles[`btn${size.charAt(0).toUpperCase()}${size.slice(1)}`],
    block ? styles.btnBlock : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (to) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
