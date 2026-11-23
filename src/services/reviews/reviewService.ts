import { supabase } from "../supabase/client";
import type { Review, ReviewInput } from "../../types/review";

const REVIEW_SELECT = `id,company_id,reviewer_id,rating,comment,created_at,
reviewer:companies!reviewer_id(id,company_name,trade_name,logo_url)`;

export async function listReviews(companyId: string) {
  const { data, error } = await supabase
    .from("reviews")
    .select(REVIEW_SELECT)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as Review[];
}

export async function createReview(reviewerId: string, input: ReviewInput) {
  const { data, error } = await supabase
    .from("reviews")
    .insert({
      company_id: input.company_id,
      reviewer_id: reviewerId,
      rating: input.rating,
      comment: input.comment ?? null,
    })
    .select(REVIEW_SELECT)
    .single();

  if (error) throw error;

  return data as unknown as Review;
}
