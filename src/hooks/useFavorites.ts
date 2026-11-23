import { useCallback, useEffect, useState } from "react";
import {
  listFavorites,
  toggleFavorite,
} from "../services/favorites/favoriteService";
import type { Favorite } from "../types/favorite";
import { useAuth } from "../contexts/AuthContext";

export function useFavorites() {
  const { user, profile } = useAuth();
  const userId = profile?.id ?? user?.id ?? null;
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await listFavorites(userId);
      setFavorites(data);
    } catch {
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isFavorite = useCallback(
    (productId: string) => {
      return favorites.some((f) => f.product_id === productId);
    },
    [favorites]
  );

  const toggle = useCallback(
    async (productId: string) => {
      if (!userId) return false;
      const nowFavorite = await toggleFavorite(userId, productId);
      if (nowFavorite) {
        await refresh();
      } else {
        setFavorites((current) =>
          current.filter((f) => f.product_id !== productId)
        );
      }
      return nowFavorite;
    },
    [userId, refresh]
  );

  return { favorites, loading, isFavorite, toggle, refresh };
}
