import { useState } from "react";
import { Link } from "react-router-dom";
import { FiArchive, FiArrowUpRight, FiCheckCircle, FiEdit2, FiEye, FiHeart, FiMapPin, FiPackage, FiStar } from "react-icons/fi";

import styles from "./ProductCard.module.css";

import { useMediaUrl } from "../../../hooks/useMediaUrl";
import { Badge, StarRating } from "../../ui";
import { formatCurrency, formatQuantity } from "../../../utils/format";
import type { Product, ProductStatus } from "../../../types/product";

const PRODUCT_STATUS: Record<
  ProductStatus,
  { label: string; variant: "success" | "neutral" | "danger" }
> = {
  active: { label: "Ativo", variant: "success" },
  inactive: { label: "Inativo", variant: "neutral" },
  sold: { label: "Vendido", variant: "danger" },
};

interface ProductCardProps {
  product: Product;
  variant?: "catalog";
  marketplaceSearch?: string;
  showCompany?: boolean;
  showActions?: boolean;
  onEdit?: (product: Product) => void;
  onDelete?: (product: Product) => void;
  onFavorite?: (product: Product) => void;
  isFavorite?: boolean;
}

export default function ProductCard({
  product,
  variant,
  marketplaceSearch,
  showCompany = false,
  showActions = false,
  onEdit,
  onDelete,
  onFavorite,
  isFavorite = false,
}: ProductCardProps) {
  const detailState = marketplaceSearch ? { marketplaceSearch } : undefined;
  const [failedImage, setFailedImage] = useState<string | null>(null);

  const imageUrl = useMediaUrl(product.main_image);
  const image = imageUrl !== failedImage ? imageUrl : null;
  const status = PRODUCT_STATUS[product.status] ?? PRODUCT_STATUS.active;
  const company = product.company;
  const catalog = variant === "catalog";
  const productPath = `/produto/${product.id}`;
  const price = product.is_free ? "Gratuito" : product.price == null ? "Sob consulta" : formatCurrency(product.price);
  const rating = Number(company?.rating) > 0
    ? Number(company?.rating).toLocaleString("pt-BR", { maximumFractionDigits: 1 })
    : null;

  const preview = (
    <>
      {image ? (
        <img
          src={image}
          alt={catalog ? "" : product.product}
          className={styles.image}
          width={400}
          height={250}
          loading="lazy"
          decoding="async"
          onError={() => setFailedImage(image)}
        />
      ) : (
        <div className={styles.placeholder}>
          {catalog && <FiPackage aria-hidden="true" />}
          <span>Sem imagem</span>
        </div>
      )}

      <span className={styles.views}>
        <FiEye aria-hidden="true" /> {product.views ?? 0}
        {catalog && <span className={styles.visuallyHidden}>visualizações</span>}
      </span>
    </>
  );

  const favoriteButton = onFavorite && (
    <button
      type="button"
      title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      aria-label={`Favoritar ${product.product}`}
      aria-pressed={isFavorite}
      className={`${styles.favBtn} ${isFavorite ? styles.favActive : ""}`}
      onClick={() => onFavorite(product)}
    >
      <FiHeart aria-hidden="true" />
    </button>
  );

  return (
    <article className={`${styles.card} ${catalog ? styles.catalog : ""}`}>
      {catalog ? (
        <div className={styles.imageWrap}>{preview}</div>
      ) : (
        <Link to={productPath} state={detailState} className={styles.imageWrap}>{preview}</Link>
      )}
      {catalog && favoriteButton}

      <div className={styles.body}>
        <div className={styles.topRow}>
          {catalog ? (
            product.category && <span className={styles.catalogCategory}>{product.category}</span>
          ) : (
            <Badge variant={status.variant}>{status.label}</Badge>
          )}
          {!catalog && product.is_free && <Badge variant="warning">Grátis</Badge>}
          {product.negotiable && <Badge variant="primary">Negociável</Badge>}
        </div>

        {catalog ? (
          <h3 className={styles.catalogTitle}>
            <Link to={productPath} state={detailState}>
              {product.product} <FiArrowUpRight aria-hidden="true" />
            </Link>
          </h3>
        ) : (
          <Link to={productPath} state={detailState} className={styles.title}>{product.product}</Link>
        )}

        <div className={styles.meta}>
          {!catalog && <span className={styles.category}>{product.category ?? "Sem categoria"}</span>}
          <span className={styles.quantity}>
            {formatQuantity(product.quantities, product.unit)}
          </span>
        </div>

        <div className={styles.price}>{catalog ? price : formatCurrency(product.price)}</div>

        {(product.city || product.state || product.locationc) && (
          <span className={styles.location}>
            <FiMapPin aria-hidden="true" />
            {[product.city, product.state].filter(Boolean).join(", ") ||
              product.locationc}
          </span>
        )}

        {showCompany && company && (
          <div className={styles.company}>
            <span className={styles.companyName}>
              {company.company_name}
              {company.verified && (catalog ? (
                <span className={styles.verifiedIcon} role="img" aria-label="Empresa verificada">
                  <FiCheckCircle aria-hidden="true" />
                </span>
              ) : (
                <Badge variant="success" className={styles.verifiedBadge}>
                  ✓
                </Badge>
              ))}
            </span>
            {catalog ? (
              rating && (
                <span className={styles.catalogRating}>
                  <FiStar aria-hidden="true" />
                  <span className={styles.visuallyHidden}>Avaliação </span>{rating}<span className={styles.visuallyHidden}> de 5</span>
                </span>
              )
            ) : <StarRating value={company.rating} size="sm" readOnly />}
          </div>
        )}

        {!catalog && <div className={styles.actions}>
          <Link to={productPath} state={detailState} className={styles.detailBtn}>
            Ver detalhes
          </Link>

          {showActions && onEdit && onDelete && (
            <div className={styles.actionIcons}>
              <button
                type="button"
                title="Editar"
                aria-label="Editar"
                onClick={() => onEdit(product)}
              >
                <FiEdit2 />
              </button>
              <button
                type="button"
                title="Arquivar"
                aria-label="Arquivar"
                className={styles.deleteBtn}
                onClick={() => onDelete(product)}
              >
                <FiArchive />
              </button>
            </div>
          )}

          {favoriteButton}
        </div>}
      </div>
    </article>
  );
}
