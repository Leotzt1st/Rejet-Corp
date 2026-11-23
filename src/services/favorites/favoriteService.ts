import { supabase } from "../supabase/client";
import type { Favorite } from "../../types/favorite";

const PRODUCT_SELECT = `id,product,description,category,subcategory,material_type,quantities,unit,weight,price,is_free,condition,locationc,cep,city,state,has_pickup,has_delivery,main_image,images,documents,status,views,created_by,created_at,updated_at,
company:companies(id,company_name,trade_name,logo_url,city,state,verified,rating)`;

export async function listFavorites(userId: string) {
  const { data, error } = await supabase
    .from("favorites")
    .select(`id,user_id,product_id,created_at,product:produtos(${PRODUCT_SELECT})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as Favorite[];
}

export async function isFavorite(userId: string, productId: string) {
  const { data, error } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function addFavorite(userId: string, productId: string) {
  const { error } = await supabase
    .from("favorites")
    .insert({ user_id: userId, product_id: productId });
  if (error) throw error;
}

export async function removeFavorite(userId: string, productId: string) {
  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", productId);
  if (error) throw error;
}

export async function toggleFavorite(userId: string, productId: string) {
  const current = await isFavorite(userId, productId);
  if (current) {
    await removeFavorite(userId, productId);
    return false;
  }
  await addFavorite(userId, productId);
  return true;
}
