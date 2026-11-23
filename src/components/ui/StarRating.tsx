import { useState } from "react";
import { FiStar } from "react-icons/fi";

interface StarRatingProps {
  value?: number | null;
  count?: number | null;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  readOnly?: boolean;
}

const SIZES = { sm: 14, md: 18, lg: 24 };

export function StarRating({
  value = 0,
  count,
  onChange,
  size = "md",
  readOnly = false,
}: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const rating = Math.max(0, Math.min(5, Number(value) || 0));
  const active = hover > 0 ? hover : rating;
  const starSize = SIZES[size];

  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      onMouseLeave={() => setHover(0)}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            aria-label={`${star} estrela${star > 1 ? "s" : ""}`}
            onMouseEnter={() => !readOnly && setHover(star)}
            onClick={() => !readOnly && onChange?.(star)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: readOnly ? "default" : "pointer",
              display: "inline-flex",
              lineHeight: 1,
            }}
          >
            <FiStar
              size={starSize}
              style={{
                color: star <= active ? "#e0a63a" : "rgba(36, 49, 39, 0.18)",
                fill: star <= active ? "#e0a63a" : "transparent",
                transition: "color 0.15s ease, fill 0.15s ease",
              }}
            />
          </button>
        ))}
      </span>

      <span style={{ fontSize: size === "sm" ? 12 : 14, color: "var(--color-text-soft)" }}>
        {value != null && Number.isFinite(Number(value))
          ? Number(value).toFixed(1)
          : ""}
        {count != null ? ` (${count})` : ""}
      </span>
    </span>
  );
}
