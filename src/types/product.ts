export type ProductStatus = "active" | "inactive" | "sold";

export interface ProductCompany {
  id: string;
  company_name: string;
  trade_name: string | null;
  logo_url: string | null;
  city: string | null;
  state: string | null;
  verified: boolean;
  rating: number;
}

export interface Product {
  id: string;
  product: string;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  material_type: string | null;
  quantities: number | null;
  unit: string | null;
  weight: number | null;
  price: number | null;
  is_free: boolean;
  negotiable: boolean;
  min_quantity: number | null;
  condition: string | null;
  locationc: string | null;
  cep: string | null;
  city: string | null;
  state: string | null;
  has_pickup: boolean;
  has_delivery: boolean;
  main_image: string | null;
  images: string[];
  documents: string[];
  status: ProductStatus;
  views: number;
  views_updated_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  company?: ProductCompany | null;
}

export interface ProductInput {
  product: string;
  description?: string;
  category?: string;
  subcategory?: string;
  material_type?: string;
  quantities?: number;
  unit: string;
  weight?: number;
  price?: number;
  is_free: boolean;
  negotiable?: boolean;
  min_quantity?: number | null;
  condition?: string;
  locationc?: string;
  cep?: string;
  city?: string;
  state?: string;
  has_pickup: boolean;
  has_delivery: boolean;
  main_image?: string | null;
  images?: string[];
  documents?: string[];
  status: ProductStatus;
}

export interface ProductFilters {
  query?: string;
  category?: string;
  subcategory?: string;
  material_type?: string;
  state?: string;
  city?: string;
  condition?: string;
  is_free?: boolean;
  negotiable?: boolean;
  min_price?: number;
  max_price?: number;
  sort?: "recent" | "price_asc" | "price_desc" | "popular";
  page?: number;
  pageSize?: number;
  only_available?: boolean;
}

export const PRODUCT_CONDITIONS = [
  { value: "novo", label: "Novo" },
  { value: "usado", label: "Usado" },
  { value: "recondicionado", label: "Recondicionado" },
  { value: "excedente", label: "Excedente de produção" },
] as const;

export const PRODUCT_UNITS = [
  { value: "kg", label: "Quilograma (kg)" },
  { value: "ton", label: "Tonelada (t)" },
  { value: "m3", label: "Metro cúbico (m³)" },
  { value: "l", label: "Litro (L)" },
  { value: "un", label: "Unidade" },
  { value: "pct", label: "Pacote" },
  { value: "pallets", label: "Paletes" },
] as const;

export const MATERIAL_TYPES = [
  "Plástico",
  "Metal",
  "Papel",
  "Papelão",
  "Vidro",
  "Madeira",
  "Borracha",
  "Eletrônico",
  "Químico",
  "Orgânico",
  "Têxtil",
  "Outro",
] as const;
