import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiAlertCircle, FiChevronDown, FiSearch, FiSliders, FiX } from "react-icons/fi";

import styles from "./MarketplacePage.module.css";

import { Button, EmptyState, Input, Loader, Pagination, Select } from "../../components/ui";
import ProductCard from "../../components/product/ProductCard/ProductCard";
import { useProducts } from "../../hooks/useProducts";
import { useFavorites } from "../../hooks/useFavorites";
import { listCategories } from "../../services/categories/categoryService";
import { useToast } from "../../components/ui/Toast";
import { formatCurrency, formatNumber } from "../../utils/format";
import { MATERIAL_TYPES, PRODUCT_CONDITIONS } from "../../types/product";
import { useAuth } from "../../contexts/AuthContext";
import type { Category } from "../../types/category";
import type { Product, ProductFilters } from "../../types/product";

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const INITIAL_FILTERS = {
  category: "",
  material_type: "",
  state: "",
  city: "",
  condition: "",
  is_free: false,
  negotiable: false,
  min_price: "",
  max_price: "",
  sort: "recent" as NonNullable<ProductFilters["sort"]>,
};

const SORT_OPTIONS = [
  { value: "recent", label: "Mais recentes" },
  { value: "popular", label: "Mais populares" },
  { value: "price_asc", label: "Menor preço" },
  { value: "price_desc", label: "Maior preço" },
];

const FILTER_KEYS = Object.keys(INITIAL_FILTERS) as (keyof typeof INITIAL_FILTERS)[];

export default function MarketplacePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const { profile, user } = useAuth();
  const { isFavorite, toggle } = useFavorites();
  const { success, error: toastError } = useToast();

  const filters = useMemo(() => {
    const sort = searchParams.get("sort");
    const state = searchParams.get("state");
    const material = searchParams.get("material_type");
    const condition = searchParams.get("condition");
    return {
      category: searchParams.get("category") ?? "",
      material_type: MATERIAL_TYPES.find((value) => value === material) ?? "",
      state: UFS.find((value) => value === state) ?? "",
      city: searchParams.get("city") ?? "",
      condition: PRODUCT_CONDITIONS.find(({ value }) => value === condition)?.value ?? "",
      is_free: searchParams.get("is_free") === "1",
      negotiable: searchParams.get("negotiable") === "1",
      min_price: searchParams.get("min_price") ?? "",
      max_price: searchParams.get("max_price") ?? "",
      sort: SORT_OPTIONS.some(({ value }) => value === sort)
        ? sort as typeof INITIAL_FILTERS.sort
        : INITIAL_FILTERS.sort,
    };
  }, [searchParams]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const requestedPage = Number(searchParams.get("page"));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 &&
    requestedPage <= Math.floor(Number.MAX_SAFE_INTEGER / 12) ? requestedPage : 1;

  useEffect(() => {
    let active = true;
    listCategories().then((items) => {
      if (active) setCategories(items);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const minPrice = filters.min_price === "" ? undefined : Number(filters.min_price);
  const maxPrice = filters.max_price === "" ? undefined : Number(filters.max_price);
  const negativePrice = (minPrice ?? 0) < 0 || (maxPrice ?? 0) < 0;
  const invalidPrice = !Number.isFinite(minPrice ?? 0) || !Number.isFinite(maxPrice ?? 0);
  const invalidRange = invalidPrice || negativePrice || (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice);
  const queryFilters = useMemo<ProductFilters>(() => ({
    query,
    category: filters.category || undefined,
    material_type: filters.material_type || undefined,
    state: filters.state || undefined,
    city: filters.city.trim() || undefined,
    condition: filters.condition || undefined,
    is_free: filters.is_free || undefined,
    negotiable: filters.negotiable || undefined,
    min_price: invalidRange ? undefined : minPrice,
    max_price: invalidRange ? undefined : maxPrice,
    sort: filters.sort,
    page,
    pageSize: 12,
    only_available: true,
  }), [query, filters, page, minPrice, maxPrice, invalidRange]);

  const { items, total, totalPages, loading, error, retry } = useProducts(queryFilters);

  function navigatePage(pageNumber: number) {
    const next = new URLSearchParams(searchParams);
    if (pageNumber === 1) next.delete("page");
    else next.set("page", String(pageNumber));
    setSearchParams(next, { preventScrollReset: true });
    resultsHeading.current?.focus({ preventScroll: true });
    resultsHeading.current?.scrollIntoView({ block: "start" });
  }

  function updateQuery(value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("q", value);
    else next.delete("q");
    next.delete("page");
    setSearchParams(next, { replace: true, preventScrollReset: true });
  }

  function updateFilter<Key extends keyof typeof INITIAL_FILTERS>(key: Key, value: (typeof INITIAL_FILTERS)[Key]) {
    const next = new URLSearchParams(searchParams);
    if (value === INITIAL_FILTERS[key]) next.delete(key);
    else next.set(key, typeof value === "boolean" ? "1" : value);
    next.delete("page");
    setSearchParams(next, { replace: true, preventScrollReset: true });
  }

  function resetFilters() {
    const next = new URLSearchParams(searchParams);
    ["q", "page", ...FILTER_KEYS].forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true, preventScrollReset: true });
  }

  async function handleFavorite(product: Product) {
    if (!profile?.id && !user?.id) {
      toastError("Faça login para salvar favoritos.");
      return;
    }
    try {
      const nowFavorite = await toggle(product.id);
      success(nowFavorite ? "Adicionado aos favoritos." : "Removido dos favoritos.");
    } catch {
      toastError("Falha ao atualizar favorito.");
    }
  }

  const appliedFilters = [
    { key: "category", label: filters.category },
    { key: "material_type", label: filters.material_type },
    { key: "state", label: filters.state },
    { key: "city", label: filters.city.trim() },
    { key: "condition", label: PRODUCT_CONDITIONS.find(({ value }) => value === filters.condition)?.label },
    { key: "is_free", label: filters.is_free ? "Grátis" : "" },
    { key: "negotiable", label: filters.negotiable ? "Negociável" : "" },
    { key: "min_price", label: minPrice !== undefined && !invalidRange ? `A partir de ${formatCurrency(minPrice)}` : "" },
    { key: "max_price", label: maxPrice !== undefined && !invalidRange ? `Até ${formatCurrency(maxPrice)}` : "" },
  ] as const;
  const activeFilters = appliedFilters.filter(({ label }) => Boolean(label));
  const hasFilters = Boolean(activeFilters.length || query.trim() || invalidRange || filters.sort !== "recent");
  const firstPageAction = page > 1 && (
    <Button variant="outline" onClick={() => navigatePage(1)}>Voltar à primeira página</Button>
  );

  return (
    <div className={styles.page}>
      <header className={styles.catalogHeader}>
        <div className={styles.catalogHeading}>
          <h2>Encontre materiais industriais</h2>
          <div className={styles.search} role="search" aria-label="Busca no catálogo">
            <FiSearch aria-hidden="true" />
            <input
              type="search"
              name="catalog-search"
              aria-label="Buscar materiais"
              placeholder="Produto ou cidade…"
              value={query}
              spellCheck={false}
              onChange={(event) => updateQuery(event.target.value)}
            />
          </div>
        </div>
      </header>

      <div className={styles.catalog}>
        <aside className={styles.filterPanel} aria-label="Filtros do catálogo" data-expanded={filtersOpen}>
          <div className={styles.filterHeader}>
            <h2><FiSliders aria-hidden="true" /> Filtros</h2>
            {hasFilters && (
              <button className={styles.clear} type="button" onClick={resetFilters}>Limpar filtros</button>
            )}
          </div>

          <button
            className={styles.mobileFilters}
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="catalog-filters"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <FiSliders aria-hidden="true" />
            Filtros{activeFilters.length > 0 ? ` (${activeFilters.length})` : ""}
            <FiChevronDown className={styles.chevron} aria-hidden="true" />
          </button>

          <div className={styles.filterFields} id="catalog-filters">
            <fieldset className={styles.filterGroup}>
              <legend>Material</legend>
              <Select
                label="Categoria" name="category" placeholder="Todas as categorias"
                value={filters.category} onChange={(event) => updateFilter("category", event.target.value)}
                options={categories.map(({ name }) => ({ value: name, label: name }))}
              />
              <Select
                label="Tipo de material" name="material_type" placeholder="Todos os materiais"
                value={filters.material_type} onChange={(event) => updateFilter("material_type", event.target.value)}
                options={MATERIAL_TYPES.map((value) => ({ value, label: value }))}
              />
              <Select
                label="Condição" name="condition" placeholder="Todas as condições"
                value={filters.condition} onChange={(event) => updateFilter("condition", event.target.value)}
                options={PRODUCT_CONDITIONS.map(({ value, label }) => ({ value, label }))}
              />
            </fieldset>

            <fieldset className={styles.filterGroup}>
              <legend>Localização</legend>
              <div className={styles.locationFields}>
                <Select
                  label="Estado" name="state" placeholder="Todos"
                  value={filters.state} onChange={(event) => updateFilter("state", event.target.value)}
                  options={UFS.map((value) => ({ value, label: value }))}
                />
                <Input
                  label="Cidade" name="city" placeholder="Campinas…"
                  value={filters.city} onChange={(event) => updateFilter("city", event.target.value)}
                />
              </div>
            </fieldset>

            <fieldset className={styles.filterGroup}>
              <legend>Preço e negociação</legend>
              <div className={styles.priceFields}>
                <Input
                  label="De (R$)" name="min_price" type="number" min={0} step="0.01"
                  aria-invalid={invalidRange} aria-describedby={invalidRange ? "catalog-price-error" : undefined}
                  value={filters.min_price} onChange={(event) => updateFilter("min_price", event.target.value)}
                />
                <Input
                  label="Até (R$)" name="max_price" type="number" min={0} step="0.01"
                  aria-invalid={invalidRange} aria-describedby={invalidRange ? "catalog-price-error" : undefined}
                  value={filters.max_price} onChange={(event) => updateFilter("max_price", event.target.value)}
                />
              </div>
              {invalidRange && (
                <p id="catalog-price-error" className={styles.fieldError} role="status">
                  {invalidPrice ? "Informe um preço válido." : negativePrice ? "Informe preços a partir de zero." : "O preço máximo deve ser igual ou maior que o mínimo."}
                </p>
              )}
              <label className={styles.checkbox}>
                <input type="checkbox" name="is_free" checked={filters.is_free} onChange={(event) => updateFilter("is_free", event.target.checked)} />
                Somente grátis
              </label>
              <label className={styles.checkbox}>
                <input type="checkbox" name="negotiable" checked={filters.negotiable} onChange={(event) => updateFilter("negotiable", event.target.checked)} />
                Aceita negociação
              </label>
            </fieldset>
          </div>
        </aside>

        <section className={styles.results} aria-labelledby="catalog-results">
          <div className={styles.resultsHeader}>
            <div>
              <h2 id="catalog-results" ref={resultsHeading} tabIndex={-1}>Materiais disponíveis</h2>
              <p className={styles.resultsCount} role="status">
                {loading ? "Buscando materiais…" : error ? "Busca indisponível" : `${formatNumber(total)} ${total === 1 ? "anúncio" : "anúncios"}`}
              </p>
            </div>
            <div className={styles.sort}>
              <Select
                label="Ordenar por" name="sort" value={filters.sort}
                onChange={(event) => updateFilter("sort", event.target.value as typeof filters.sort)}
                options={SORT_OPTIONS}
              />
            </div>
          </div>

          {hasFilters && (
            <ul className={styles.chips} role="list" aria-label="Filtros aplicados">
              {query.trim() && (
                <li><button type="button" aria-label={`Remover busca: ${query}`} onClick={() => updateQuery("")}><span>{query}</span><FiX aria-hidden="true" /></button></li>
              )}
              {activeFilters.map(({ key, label }) => (
                <li key={key}>
                  <button type="button" aria-label={`Remover filtro: ${label}`} onClick={() => updateFilter(key, INITIAL_FILTERS[key])}>
                    <span>{label}</span><FiX aria-hidden="true" />
                  </button>
                </li>
              ))}
              <li className={styles.mobileClear}><button type="button" onClick={resetFilters}>Limpar filtros</button></li>
            </ul>
          )}

          <div className={styles.resultContent} aria-busy={loading}>
            {loading ? (
              <Loader text="Buscando materiais…" />
            ) : error ? (
              <EmptyState
                icon={<FiAlertCircle aria-hidden="true" />}
                title="Não foi possível carregar os materiais"
                description={page > 1 ? "A página pode não estar mais disponível. Volte à primeira página e mantenha os filtros." : "Tente novamente para atualizar a busca."}
                action={firstPageAction || <Button variant="outline" onClick={retry}>Tentar novamente</Button>}
              />
            ) : items.length === 0 ? (
              <EmptyState
                icon={<FiSearch aria-hidden="true" />}
                title="Nenhum material encontrado"
                description={page > 1 ? "Volte à primeira página para ver os resultados com os filtros atuais." : hasFilters ? "Ajuste os filtros ou experimente outro termo de busca." : "Os anúncios disponíveis aparecerão aqui."}
                action={firstPageAction || (hasFilters && <Button variant="outline" onClick={resetFilters}>Limpar filtros</Button>)}
              />
            ) : (
              <div className={styles.grid}>
                {items.map((product) => (
                  <ProductCard
                    key={product.id} product={product} variant="catalog" showCompany
                    marketplaceSearch={searchParams.toString()}
                    isFavorite={isFavorite(product.id)} onFavorite={handleFavorite}
                  />
                ))}
              </div>
            )}
          </div>

          {!loading && !error && <Pagination totalPages={totalPages} page={page} onChange={navigatePage} />}
        </section>
      </div>
    </div>
  );
}

