import { supabase } from "../supabase/client";
import type { CompanyInput } from "../../types/company";

export interface SignUpPayload {
  company_name: string;
  cnpj: string;
  email: string;
  password: string;
  phone?: string;
  city?: string;
  state?: string;
  segment?: string;
  description?: string;
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export interface SignUpResult {
  data: { user: { id: string } | null; session: unknown | null };
  error: { message: string } | null;
  profileCreated: boolean;
}

export async function signUp(payload: SignUpPayload): Promise<SignUpResult> {
  const { password, email, ...company } = payload;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: company, emailRedirectTo: window.location.origin },
  });

  if (error || !data.user) return { data, error, profileCreated: false };

  if (data.session) {
    const profileError = await createCompanyProfile(data.user.id, payload);
    return { data, error: profileError, profileCreated: !profileError };
  }

  return { data, error: null, profileCreated: false };
}

export async function createCompanyProfile(
  userId: string,
  payload: Pick<
    SignUpPayload,
    "company_name" | "cnpj" | "email" | "phone" | "city" | "state" | "segment" | "description"
  >
) {
  const { error } = await supabase.from("companies").upsert(
    {
      id: userId,
      company_name: payload.company_name,
      cnpj: payload.cnpj,
      email: payload.email,
      phone: payload.phone ?? null,
      city: payload.city ?? null,
      state: payload.state ?? null,
      segment: payload.segment ?? null,
      description: payload.description ?? null,
    },
    { onConflict: "id", ignoreDuplicates: true }
  );
  return error;
}

export async function updateProfile(userId: string, input: CompanyInput) {
  const { error } = await supabase
    .from("companies")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", userId);
  return error;
}

export async function signOut() {
  localStorage.removeItem("rejet_pending_company");
  return supabase.auth.signOut();
}

export async function resetPassword(email: string) {
  const origin = window.location.origin;
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/redefinir-senha`,
  });
}

export async function updatePassword(newPassword: string) {
  return supabase.auth.updateUser({ password: newPassword });
}

export async function updateEmail(email: string) {
  return supabase.auth.updateUser({ email });
}
