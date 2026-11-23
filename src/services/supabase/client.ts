import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key",
);

export function getErrorMessage(error: unknown, fallback = "Erro inesperado.") {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: string }).message);
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
