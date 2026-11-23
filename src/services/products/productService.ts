import { supabase } from "../supabase/client";
import { readAllRows } from "../supabase/readAllRows";
import type { Product, ProductInput, ProductFilters } from "../../types/product";

const PRODUCT_SELECT = `id,product,description,category,subcategory,material_type,quantities,unit,weight,price,is_free,negotiable,min_quantity,condition,locationc,cep,city,state,has_pickup,has_delivery,main_image,images,documents,status,views,views_updated_at,created_by,created_at,updated_at,
company:companies(id,company_name,trade_name,logo_url,city,state,verified,rating)`;

export function buildProductQuery(filters: ProductFilters = {}) {
  let query = supabase
    .from("produtos")
    .select(PRODUCT_SELECT, { count: "exact" });

  if (filters.query) {
    const q = filters.query.trim();
    if (q) {
      query = query.or(
        `product.ilike.%${q}%,description.ilike.%${q}%,locationc.ilike.%${q}%,city.ilike.%${q}%,state.ilike.%${q}%`
      );
    }
  }

  if (filters.category) query = query.eq("category", filters.category);
  if (filters.material_type) query = query.eq("material_type", filters.material_type);
  if (filters.state) query = query.eq("state", filters.state);
  if (filters.city) query = query.eq("city", filters.city);
  if (filters.condition) query = query.eq("condition", filters.condition);
  if (filters.is_free !== undefined) query = query.eq("is_free", filters.is_free);
  if (filters.negotiable) query = query.eq("negotiable", true);
  if (filters.min_price !== undefined) query = query.gte("price", filters.min_price);
  if (filters.max_price !== undefined) query = query.lte("price", filters.max_price);

  if (filters.only_available) query = query.eq("status", "active");
  else query = query.in("status", ["active", "sold"]);

  const sortMap: Record<string, string> = {
    recent: "created_at",
    popular: "views",
  };
  if (filters.sort === "price_asc") query = query.order("price", { ascending: true });
  else if (filters.sort === "price_desc") query = query.order("price", { ascending: false });
  else query = query.order(sortMap[filters.sort ?? "recent"] ?? "created_at", { ascending: false });

  return query;
}

export async function listProducts(filters: ProductFilters = {}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 12;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = buildProductQuery(filters);
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    items: (data ?? []) as unknown as Product[],
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  };
}

export async function getProduct(id: string) {
  const { data, error } = await supabase
    .from("produtos")
    .select(PRODUCT_SELECT)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as unknown as Product;
}

export async function incrementProductViews(id: string) {
  await supabase.rpc("increment_views", { row_id: id });
}

export async function createProduct(payload: ProductInput) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Usuário não autenticado.");

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (companyError) throw companyError;

  if (!company) {
    throw new Error(
      "Perfil da empresa não encontrado. Complete seu cadastro antes de cadastrar produtos.",
    );
  }

  const row = {
    ...payload,
    created_by: user.id,
  };

  const { data, error } = await supabase
    .from("produtos")
    .insert(row)
    .select(PRODUCT_SELECT)
    .single();

  if (error) throw error;
  return data as unknown as Product;
}

export async function updateProduct(id: string, payload: Partial<ProductInput>) {
  const { data, error } = await supabase
    .from("produtos")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(PRODUCT_SELECT)
    .single();

  if (error) throw error;
  return data as unknown as Product;
}

export async function archiveProduct(id: string) {
  const { error } = await supabase
    .from("produtos")
    .update({ status: "inactive", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw error;
}

export async function listMyProducts(userId: string, status?: string) {
  const rows = await readAllRows((from, to) => {
    const query = supabase
      .from("produtos")
      .select(PRODUCT_SELECT, from === 0 ? { count: "exact" } : undefined)
      .eq("created_by", userId)
      .order("created_at", { ascending: false })
      .order("id");
    return (status ? query.eq("status", status) : query).range(from, to);
  });
  return rows as unknown as Product[];
}

export async function listRelatedProducts(product: Product, limit = 4) {
  let query = supabase
    .from("produtos")
    .select(PRODUCT_SELECT)
    .neq("id", product.id)
    .eq("status", "active")
    .limit(limit);

  if (product.category) {
    query = query.eq("category", product.category);
  }

  const { data, error } = await query;
  if (error) throw error;

  const related = (data ?? []) as unknown as Product[];
  if (related.length < limit) {
    const ids = related.map((p) => p.id);
    let fallback = supabase
      .from("produtos")
      .select(PRODUCT_SELECT)
      .neq("id", product.id)
      .eq("status", "active")
      .limit(limit);

    if (ids.length > 0) fallback = fallback.not("id", "in", `(${ids.join(",")})`);

    const { data: extra, error: extraError } = await fallback;
    if (!extraError && extra) {
      related.push(...(extra as unknown as Product[]));
    }
  }

  return related.slice(0, limit);
}
