export type CompanyRole = "company" | "admin";

export interface Company {
  id: string;
  company_name: string;
  trade_name: string | null;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
  segment: string | null;
  description: string | null;
  website: string | null;
  instagram: string | null;
  linkedin: string | null;
  logo_url: string | null;
  banner_url: string | null;
  role: CompanyRole;
  verified: boolean;
  active: boolean;
  onboarding_done: boolean;
  rating: number;
  review_count: number;
  created_at: string;
  updated_at: string;
}

export interface CompanyInput {
  company_name?: string;
  trade_name?: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  cep?: string;
  segment?: string;
  description?: string;
  website?: string;
  instagram?: string;
  linkedin?: string;
  logo_url?: string;
  banner_url?: string;
}
