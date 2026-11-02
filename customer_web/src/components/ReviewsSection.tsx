import { useState } from 'react';
import { useReviews } from '../data/hooks';
import { reviewsCountText } from './Bits';
import { t } from '../i18n';

const TAG_LABEL: Record<string, string> = {
  quality: t('الجودة'),
  delivery: t('سرعة التوصيل'),
  punctual: t('الالتزام بالموعد'),
  service: t('حسن التعامل'),
  price: t('سعر مناسب'),
};

const Stars = ({ value }: { value: number }) => (
  <span className="stars" role="img" aria-label={t('{0} من 5', value)}>
    {'★'.repeat(value)}
    <span className="stars-off">{'★'.repeat(5 - value)}</span>
  </span>
);

const PREVIEW = 3;

/** What customers said; nothing at all until someone has rated. */
export function ReviewsSection({ field, id }: { field: 'targetId' | 'companyId'; id: string }) {
  const reviews = useReviews(field, id);
  const [all, setAll] = useState(false);
  if (reviews.length === 0) return null;
  const average = reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length;
  const shown = all ? reviews : reviews.slice(0, PREVIEW);
  return (
    <section className="tile reviews" aria-label={t('التقييمات')}>
      <h2>{t('التقييمات')}</h2>
      <div className="review-summary">
        <strong>{average.toFixed(1)}</strong>
        <span>
          <Stars value={Math.round(average)} />
          <span className="pmeta" style={{ display: 'block' }}>{reviewsCountText(reviews.length)}</span>
        </span>
      </div>
      {shown.map((r) => {
        const name = r.authorName.trim() || t('عميل');
        return (
          <article key={r.id} className="review">
            <header>
              <span className="review-avatar">{[...name][0]}</span>
              <span className="grow">
                <strong>{name}</strong>
                <span className="verified">{t('عميل مؤكَّد')}</span>
              </span>
              <span style={{ textAlign: 'end' }}>
                <Stars value={r.stars} />
                <time className="pmeta" dir="ltr" style={{ display: 'block' }}>
                  {r.createdAt.toISOString().slice(0, 10)}
                </time>
              </span>
            </header>
            {r.tags.length > 0 && (
              <div className="ptags">
                {r.tags.map((tag) => <span key={tag}>{TAG_LABEL[tag] ?? tag}</span>)}
              </div>
            )}
            {r.comment && <p>{r.comment}</p>}
            {r.reply && (
              <blockquote>
                <strong>{t('رد الشركة ·')}{' '}{r.companyName}</strong>
                <p>{r.reply}</p>
              </blockquote>
            )}
          </article>
        );
      })}
      {!all && reviews.length > PREVIEW && (
        <button className="link-btn" onClick={() => setAll(true)}>{t('عرض كل التقييمات (')}{reviews.length})</button>
      )}
    </section>
  );
}
