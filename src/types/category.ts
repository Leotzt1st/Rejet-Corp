export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  active: boolean;
  created_at: string;
}

export interface CategoryInput {
  name: string;
  slug: string;
  icon?: string;
  active?: boolean;
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
}
