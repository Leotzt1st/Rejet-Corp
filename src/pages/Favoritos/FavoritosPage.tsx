import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiHeart } from "react-icons/fi";

import styles from "./FavoritosPage.module.css";

import { Button, EmptyState, Loader } from "../../components/ui";
import ProductCard from "../../components/product/ProductCard/ProductCard";
import { useFavorites } from "../../hooks/useFavorites";
import { useToast } from "../../components/ui/Toast";
import type { Favorite } from "../../types/favorite";

export default function FavoritosPage() {
  const { favorites, loading, toggle } = useFavorites();
  const { success, error } = useToast();
  const [items, setItems] = useState<Favorite[]>([]);

  useEffect(() => {
    setItems(favorites);
  }, [favorites]);

  async function handleRemove(favorite: Favorite) {
    try {
      await toggle(favorite.product_id);
      setItems((current) => current.filter((item) => item.id !== favorite.id));
      success("Removido dos favoritos.");
    } catch {
      error("Falha ao remover dos favoritos.");
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Materiais salvos</h2>
          <p className={styles.subtitle}>
            {items.length} produto{items.length !== 1 ? "s" : ""} salvo
            {items.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {loading ? (
        <Loader text="Carregando favoritos..." />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FiHeart aria-hidden="true" />}
          title="Nenhum favorito ainda"
          description="Salve produtos interessantes para acompanhar depois."
          action={
            <Button to="/marketplace">Explorar marketplace</Button>
          }
        />
      ) : (
        <div className={styles.grid}>
          {items.map((favorite) => {
            if (!favorite.product) return null;
            return (
              <ProductCard
                key={favorite.id}
                product={favorite.product}
                variant="catalog"
                showCompany
                isFavorite
                onFavorite={() => handleRemove(favorite)}
              />
            );
          })}
        </div>
      )}

      {items.length > 0 && (
        <div className={styles.footer}>
          <Link to="/marketplace" className={styles.continue}>
            Continuar explorando
          </Link>
        </div>
      )}
    </div>
  );
}
