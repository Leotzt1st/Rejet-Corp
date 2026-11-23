import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  FiBriefcase,
  FiDownload,
  FiFlag,
  FiFile,
  FiHeart,
  FiMapPin,
  FiMessageSquare,
  FiPackage,
  FiShare2,
} from "react-icons/fi";

import styles from "./ProductDetailPage.module.css";

import {
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Card,
  EmptyState,
  Loader,
  StarRating,
  Modal,
  Textarea,
} from "../../components/ui";
import ProductCard from "../../components/product/ProductCard/ProductCard";
import NegotiationModal from "../../components/negotiation/NegotiationModal/NegotiationModal";
import { ReviewSection } from "../../components/reviews/ReviewSection/ReviewSection";
import {
  getProduct,
  incrementProductViews,
  listRelatedProducts,
} from "../../services/products/productService";
import { getMediaUrl } from "../../services/storage/storageService";
import { getOrCreateConversation } from "../../services/messages/messageService";
import { createReport } from "../../services/reports/reportService";
import { useFavorites } from "../../hooks/useFavorites";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../contexts/AuthContext";
import { useMediaUrl } from "../../hooks/useMediaUrl";
import {
  formatCurrency,
  formatQuantity,
} from "../../utils/format";
import { PRODUCT_CONDITIONS, type Product } from "../../types/product";

function ProductThumbnail({ path }: { path: string }) {
  const url = useMediaUrl(path);
  return url ? <img src={url} alt="" /> : null;
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile, user } = useAuth();
  const currentUserId = profile?.id ?? user?.id ?? null;
  const navigate = useNavigate();
  const marketplaceSearch: unknown = useLocation().state?.marketplaceSearch;
  const marketplacePath = typeof marketplaceSearch === "string" && marketplaceSearch
    ? `/marketplace?${new URLSearchParams(marketplaceSearch)}`
    : "/marketplace";

  const { isFavorite, toggle } = useFavorites();
  const { success, error } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [negotiateOpen, setNegotiateOpen] = useState(false);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [startingChat, setStartingChat] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;

    setLoading(true);
    setProduct(null);

    getProduct(id)
      .then((data) => {
        if (!active) return;
        setProduct(data);
        setActiveImage(data.main_image ?? data.images?.[0] ?? null);

        if (id) {
          incrementProductViews(id).catch(() => undefined);
        }

        return listRelatedProducts(data).then((items) => {
          if (active) setRelated(items);
        });
      })
      .catch((err) => {
        if (active) {
          error(err instanceof Error ? err.message : "Erro ao carregar produto.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, error]);

  const gallery = useMemo(() => {
    const images = product ? [product.main_image, ...(product.images ?? [])] : [];
    return [...new Set(images.filter((image): image is string => Boolean(image)))];
  }, [product]);

  const currentImage = useMediaUrl(activeImage);

  async function openDocument(path: string) {
    try {
      const url = await getMediaUrl(path, true);
      if (!url) {
        error("Documento indisponível para sua conta.");
        return;
      }
      window.location.assign(url);
    } catch {
      error("Não foi possível baixar o documento.");
    }
  }

  async function handleFavorite() {
    if (!currentUserId) {
      error("Faça login para salvar favoritos.");
      return;
    }
    try {
      const nowFavorite = await toggle(product!.id);
      success(nowFavorite ? "Adicionado aos favoritos." : "Removido dos favoritos.");
    } catch {
      error("Falha ao atualizar favorito.");
    }
  }

  function handleShare() {
    navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => success("Link copiado!"))
      .catch(() => undefined);
  }

  async function handleStartChat() {
    if (!currentUserId || !product?.company) return;
    setStartingChat(true);
    try {
      const conversationId = await getOrCreateConversation(currentUserId, {
        product_id: product.id,
        participant_b: product.company.id,
      });
      navigate(`/mensagens?conversa=${encodeURIComponent(conversationId)}`);
    } catch {
      error("Falha ao iniciar conversa.");
    } finally {
      setStartingChat(false);
    }
  }

  async function handleReportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !product || !reportReason.trim()) return;

    setSubmittingReport(true);
    try {
      await createReport(user.id, {
        target_type: "product",
        target_id: product.id,
        reason: reportReason.trim(),
      });
      setReportReason("");
      setReportOpen(false);
      success("Denúncia enviada para análise.");
    } catch (err) {
      error(err instanceof Error ? err.message : "Falha ao enviar a denúncia.");
    } finally {
      setSubmittingReport(false);
    }
  }

  if (loading) {
    return <Loader text="Carregando produto..." fullPage />;
  }

  if (!product) {
    return (
      <EmptyState
        icon={<FiPackage aria-hidden="true" />}
        title="Produto não encontrado"
        description="O produto pode ter sido removido ou o link está incorreto."
      />
    );
  }

  const isMine = currentUserId != null && product.created_by === currentUserId;
  const company = product.company;

  return (
    <div className={styles.page}>
      <Breadcrumb
        items={[
          { label: "Marketplace", to: marketplacePath },
          { label: product.product },
        ]}
      />

      <div className={styles.layout}>
        <div className={styles.gallery}>
          <div className={styles.mainImage}>
            {currentImage ? (
              <img src={currentImage} alt={product.product} width={720} height={480} />
            ) : (
              <div className={styles.noImage}>
                <span>Sem imagem</span>
              </div>
            )}
          </div>

          {gallery.length > 1 && (
            <div className={styles.thumbs}>
              {gallery.map((image, index) => (
                <button
                  key={image}
                  type="button"
                  aria-label={`Ver imagem ${index + 1} de ${gallery.length}`}
                  aria-pressed={activeImage === image}
                  className={`${styles.thumb} ${activeImage === image ? styles.thumbActive : ""}`}
                  onClick={() => setActiveImage(image)}
                >
                  <ProductThumbnail path={image} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.info}>
          <div className={styles.badges}>
            <Badge variant={product.status === "active" ? "success" : "neutral"}>
              {product.status === "active" ? "Disponível" : "Indisponível"}
            </Badge>
            {product.is_free && <Badge variant="warning">Grátis</Badge>}
            {product.condition && (
              <Badge variant="secondary">
                {PRODUCT_CONDITIONS.find(({ value }) => value === product.condition)?.label ?? product.condition}
              </Badge>
            )}
            {product.negotiable && (
              <Badge variant="primary">Negociável</Badge>
            )}
          </div>

          <h2 className={styles.title}>{product.product}</h2>

          <div className={styles.price}>
            {product.is_free ? "Gratuito" : formatCurrency(product.price)}
          </div>

          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <span>Quantidade</span>
              <strong>{formatQuantity(product.quantities, product.unit)}</strong>
            </div>
            {product.min_quantity != null && product.min_quantity > 0 && (
              <div className={styles.metaItem}>
                <span>Qtd. mínima</span>
                <strong>{formatQuantity(product.min_quantity, product.unit)}</strong>
              </div>
            )}
            {product.material_type && (
              <div className={styles.metaItem}>
                <span>Material</span>
                <strong>{product.material_type}</strong>
              </div>
            )}
            {product.views != null && (
              <div className={styles.metaItem}>
                <span>Visualizações</span>
                <strong>{product.views}</strong>
              </div>
            )}
          </div>

          {(product.city || product.state || product.cep || product.locationc) && (
            <div className={styles.location}>
              <FiMapPin />
              {[product.city, product.state].filter(Boolean).join(", ") ||
                product.locationc}
              {product.cep && <span>({product.cep})</span>}
            </div>
          )}

          {product.description && (
            <div className={styles.description}>
              <h3>Descrição</h3>
              <p>{product.description}</p>
            </div>
          )}

          {product.documents && product.documents.length > 0 && (
            <div className={styles.documents}>
              <h3><FiFile aria-hidden="true" /> Documentos</h3>
              <div className={styles.docList}>
                {product.documents.map((doc) => {
                  const name = doc.split("/").pop() ?? "Documento";
                  return (
                    <button
                      key={doc}
                      type="button"
                      className={styles.docLink}
                      onClick={() => void openDocument(doc)}
                    >
                      <FiDownload aria-hidden="true" /> {name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className={styles.actions}>
            {!isMine && product.status === "active" ? (
              <Button onClick={() => setNegotiateOpen(true)}>
                <FiBriefcase /> Enviar interesse
              </Button>
            ) : null}

            {isMine && (
              <Button to={`/cadastrar-produto?edit=${encodeURIComponent(product.id)}`}>
                Editar produto
              </Button>
            )}

            <Button variant="outline" onClick={handleFavorite}>
              <FiHeart /> {isFavorite(product.id) ? "Favoritado" : "Favoritar"}
            </Button>

            <Button variant="ghost" onClick={handleShare}>
              <FiShare2 /> Compartilhar
            </Button>

            {!isMine && (
              <Button
                variant="ghost"
                onClick={() => {
                  if (!user) {
                    error("Faça login para denunciar este produto.");
                    return;
                  }
                  setReportOpen(true);
                }}
              >
                <FiFlag /> Denunciar produto
              </Button>
            )}
          </div>
        </div>
      </div>

      {company && (
        <Card className={styles.companyCard}>
          <Avatar
            src={company.logo_url}
            name={company.company_name}
            size="lg"
          />
          <div className={styles.companyInfo}>
            <h2 className={styles.companyName}>
              {company.company_name}
              {company.verified && <Badge variant="success">Verificada</Badge>}
            </h2>
            <StarRating value={company.rating} />
            <span className={styles.companyMeta}>
              {[company.city, company.state].filter(Boolean).join(", ") || "Localização não informada"}
            </span>
          </div>
          {!isMine && (
            <Button
              variant="secondary"
              onClick={handleStartChat}
              disabled={startingChat}
            >
              <FiMessageSquare /> {startingChat ? "Abrindo..." : "Conversar com a empresa"}
            </Button>
          )}
        </Card>
      )}

      {company && (
        <ReviewSection key={company.id} companyId={company.id} isOwnCompany={isMine} />
      )}

      {related.length > 0 && (
        <section>
          <h2 className={styles.sectionTitle}>Produtos relacionados</h2>
          <div className={styles.relatedGrid}>
            {related.map((item) => (
              <ProductCard
                key={item.id} product={item} variant="catalog" showCompany
                marketplaceSearch={typeof marketplaceSearch === "string" ? marketplaceSearch : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {!isMine && (
        <NegotiationModal
          key={`${product.id}:${product.unit}`}
          open={negotiateOpen}
          product={product}
          onClose={() => setNegotiateOpen(false)}
          onCreated={() => success("Interesse enviado!")}
        />
      )}

      <Modal
        open={reportOpen}
        title="Denunciar produto"
        subtitle="Explique o motivo. A equipe analisará sua denúncia."
        onClose={() => setReportOpen(false)}
      >
        <form onSubmit={handleReportSubmit}>
          <Textarea
            label="Motivo"
            name="reportReason"
            maxLength={2000}
            rows={4}
            required
            value={reportReason}
            onChange={(event) => setReportReason(event.target.value)}
          />
          <Button type="submit" disabled={!reportReason.trim() || submittingReport}>
            {submittingReport ? "Enviando..." : "Enviar denúncia"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
