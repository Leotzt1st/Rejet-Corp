export function formatCurrency(value: number | null | undefined) {
  if (value == null || isNaN(Number(value))) return "—";
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatNumber(value: number | null | undefined) {
  if (value == null || isNaN(Number(value))) return "0";
  return Number(value).toLocaleString("pt-BR");
}

export function formatQuantity(value: number | null | undefined, unit?: string | null) {
  if (value == null || isNaN(Number(value))) return "—";
  const base = Number(value).toLocaleString("pt-BR", {
    maximumFractionDigits: 3,
  });
  return unit ? `${base} ${unit}` : base;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "—";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "agora mesmo";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d atrás`;
  return formatDate(value);
}

export function formatCEP(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length !== 8) return value ?? "";
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function formatCNPJ(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length !== 14) return value ?? "";
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(
    5,
    8
  )}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function formatPhone(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return value ?? "";
}

export function initials(name: string | null | undefined) {
  if (!name) return "R";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
