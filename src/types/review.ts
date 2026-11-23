import type { Company } from "./company";

export interface Review {
  id: string;
  company_id: string;
  reviewer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer?: Pick<
    Company,
    "id" | "company_name" | "logo_url" | "trade_name"
  > | null;
}

export interface ReviewInput {
  company_id: string;
  rating: number;
  comment?: string;
}
