import { useEffect, useMemo, useState } from "react";
import { listProducts } from "../services/products/productService";
import type { Product, ProductFilters } from "../types/product";
import { useDebounce } from "./useDebounce";

export function useProducts(filters: ProductFilters = {}) {
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  const debouncedQuery = useDebounce(filters.query ?? "", 400);
  const queryFilters = useMemo(
    () => ({ ...filters, query: debouncedQuery }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedQuery, filters.page, filters.pageSize, filters.category, filters.subcategory, filters.state, filters.city, filters.sort, filters.is_free, filters.negotiable, filters.condition, filters.material_type, filters.min_price, filters.max_price, filters.only_available]
  );

  useEffect(() => {
    let active = true;

    setLoading(true);
    listProducts(queryFilters)
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setTotal(result.total);
        setTotalPages(result.totalPages);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Erro ao carregar produtos.");
        setItems([]);
        setTotal(0);
        setTotalPages(1);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [queryFilters, requestVersion]);

  return {
    items,
    total,
    totalPages,
    loading: loading || debouncedQuery !== (filters.query ?? ""),
    error,
    retry: () => setRequestVersion((version) => version + 1),
  };
}
