import { supabase } from "../supabase/client";
import type { Category, CategoryInput } from "../../types/category";

export async function listCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("id,name,slug,icon,active,created_at")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function listAllCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("id,name,slug,icon,active,created_at")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function createCategory(input: CategoryInput) {
  const { data, error } = await supabase
    .from("categories")
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data as Category;
}

export async function updateCategory(id: string, input: Partial<CategoryInput>) {
  const { error } = await supabase
    .from("categories")
    .update(input)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}

export async function listSubcategories(categoryId: string) {
  const { data, error } = await supabase
    .from("subcategories")
    .select("id,category_id,name")
    .eq("category_id", categoryId)
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
