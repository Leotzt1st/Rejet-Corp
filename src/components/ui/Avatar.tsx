import styles from "./ui.module.css";
import { useMediaUrl } from "../../hooks/useMediaUrl";

type AvatarSize = "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: AvatarSize;
}

function initials(name?: string | null) {
  if (!name) return "R";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ src, name, size = "md" }: AvatarProps) {
  const sizeClass =
    size === "sm"
      ? styles.avatarSm
      : size === "lg"
        ? styles.avatarLg
        : size === "xl"
          ? styles.avatarXl
          : styles.avatarMd;

  const url = useMediaUrl(src);

  if (url) {
    return <img className={`${styles.avatar} ${sizeClass}`} src={url} alt={name ?? ""} />;
  }

  return <span className={`${styles.avatar} ${sizeClass}`}>{initials(name)}</span>;
}
