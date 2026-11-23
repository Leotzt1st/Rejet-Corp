import { supabase } from "../supabase/client";
import type { Company, CompanyInput } from "../../types/company";

const COMPANY_SELECT = "id,company_name,trade_name,city,state,segment,description,website,instagram,linkedin,logo_url,banner_url,role,verified,active,rating,review_count,created_at,updated_at";
type DirectoryCompany = Omit<Company, "cnpj" | "email" | "phone" | "address" | "cep" | "onboarding_done">;

export async function getCompany(id: string) {
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_SELECT)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as DirectoryCompany;
}

export async function getCurrentCompany(userId: string) {
  const { data, error } = await supabase
    .rpc("get_my_company")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data as Company | null) ?? null;
}

export async function listCompanies(query = "") {
  let request = supabase
    .from("companies")
    .select(COMPANY_SELECT)
    .order("company_name", { ascending: true });

  const q = query.trim();
  if (q) {
    request = request.or(
      `company_name.ilike.%${q}%,trade_name.ilike.%${q}%,city.ilike.%${q}%,segment.ilike.%${q}%`
    );
  }

  const { data, error } = await request;
  if (error) throw error;
  return (data ?? []) as DirectoryCompany[];
}

export async function updateCompany(id: string, input: CompanyInput) {
  const { error } = await supabase
    .from("companies")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markOnboardingDone(id: string) {
  const { error } = await supabase
    .from("companies")
    .update({ onboarding_done: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
