import { useEffect, useState, type FormEvent } from "react";
import { FiStar } from "react-icons/fi";

import styles from "./ReviewSection.module.css";

import { Avatar, Button, Card, EmptyState, Loader, StarRating, Textarea } from "../../ui";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../ui/Toast";
import { timeAgo } from "../../../utils/format";
import { listReviews, createReview } from "../../../services/reviews/reviewService";
import type { Review } from "../../../types/review";

interface ReviewSectionProps {
  companyId: string;
  isOwnCompany: boolean;
}

export function ReviewSection({ companyId, isOwnCompany }: ReviewSectionProps) {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadFailed(false);

    listReviews(companyId)
      .then((data) => {
        if (active) setReviews(data);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [companyId, loadAttempt]);

  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  const totalReviews = reviews.length;
  const alreadyReviewed = reviews.some((review) => review.reviewer_id === user?.id);
  const avgRating =
    totalReviews > 0
      ? reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews
      : 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || isOwnCompany || alreadyReviewed || loadFailed || submitting || rating === 0) return;

    setSubmitting(true);
    try {
      const review = await createReview(user.id, {
        company_id: companyId,
        rating,
        comment: comment.trim() || undefined,
      });
      setReviews((prev) => [review, ...prev]);
      setRating(0);
      setComment("");
      success("Avaliação enviada!");
    } catch (err) {
      const code = typeof err === "object" && err !== null && "code" in err ? err.code : undefined;
      if (code === "23505") {
        error("Você já avaliou esta empresa.");
        setLoadAttempt((attempt) => attempt + 1);
      } else {
        error("Não foi possível enviar sua avaliação. Seu texto foi mantido. Tente novamente.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Avaliações</h2>
      <p className={styles.disclosure}>
        Publicadas por empresas cadastradas. A plataforma não verifica se houve transação.
      </p>

      {loading ? (
        <Loader text="Carregando avaliações…" />
      ) : loadFailed ? (
        <EmptyState
          title="Não foi possível carregar as avaliações"
          action={<Button variant="outline" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Tentar novamente</Button>}
        />
      ) : (
        <>
          {totalReviews > 0 && (
            <Card className={styles.summary}>
              <div className={styles.avgBlock}>
                <span className={styles.avgNumber}>{avgRating.toFixed(1)}</span>
                <StarRating value={avgRating} size="lg" readOnly />
                <span className={styles.avgCount}>
                  {totalReviews} {totalReviews === 1 ? "avaliação" : "avaliações"}
                </span>
              </div>

              <div className={styles.distribution}>
                {distribution.map((d) => (
                  <div key={d.star} className={styles.distRow}>
                    <span className={styles.distLabel}>{d.star}</span>
                    <FiStar size={13} className={styles.distStar} />
                    <div className={styles.distBarBg}>
                      <div
                        className={styles.distBarFill}
                        style={{
                          width: totalReviews > 0 ? `${(d.count / totalReviews) * 100}%` : "0%",
                        }}
                      />
                    </div>
                    <span className={styles.distCount}>{d.count}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {!isOwnCompany && user && alreadyReviewed && <p>Você já avaliou esta empresa.</p>}
          {!isOwnCompany && user && !alreadyReviewed && (
            <Card title="Deixe sua avaliação" className={styles.formCard}>
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.ratingRow}>
                  <span className={styles.ratingLabel}>Nota</span>
                  <StarRating value={rating} onChange={setRating} size="lg" />
                </div>

                <Textarea
                  label="Comentário (opcional)"
                  name="comment"
                  rows={3}
                  placeholder="O que achou da empresa?"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />

                <Button type="submit" disabled={rating === 0 || submitting}>
                  {submitting ? "Enviando…" : "Enviar avaliação"}
                </Button>
              </form>
            </Card>
          )}

          {reviews.length === 0 ? (
            <EmptyState
              icon="⭐"
              title="Nenhuma avaliação ainda"
              description="Seja o primeiro a avaliar esta empresa."
            />
          ) : (
            <div className={styles.list}>
              {reviews.map((review) => {
                const reviewerName =
                  review.reviewer?.trade_name ||
                  review.reviewer?.company_name ||
                  "Anônimo";
                return (
                  <Card key={review.id} className={styles.reviewCard}>
                    <div className={styles.reviewHeader}>
                      <Avatar
                        src={review.reviewer?.logo_url ?? null}
                        name={reviewerName}
                        size="sm"
                      />
                      <div className={styles.reviewMeta}>
                        <span className={styles.reviewName}>{reviewerName}</span>
                        <span className={styles.reviewTime}>
                          {timeAgo(review.created_at)}
                        </span>
                      </div>
                      <StarRating value={review.rating} size="sm" readOnly />
                    </div>
                    {review.comment && (
                      <p className={styles.reviewComment}>{review.comment}</p>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
