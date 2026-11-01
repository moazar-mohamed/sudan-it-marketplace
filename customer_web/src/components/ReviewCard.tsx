import { useState } from 'react';
import { useCatalog } from '../data/DataProvider';
import { formatDate } from '../data/format';
import { useReview } from '../data/hooks';
import { canEdit, COMMENT_MAX, editableUntil, editReview, ORDER_TAGS, rateOrder, STAR_LABELS } from '../data/reviews';
import type { Order, Review } from '../data/types';

function StarPicker({ stars, onChange }: { stars: number; onChange: (n: number) => void }) {
  return (
    <div className="star-picker" role="radiogroup" aria-label="التقييم">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={stars === n}
          aria-label={`${n} من 5 نجوم`}
          className={n <= stars ? 'on' : ''}
          onClick={() => onChange(n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function ReviewForm({ order, existing, initialStars, onClose }: { order: Order; existing: Review | null; initialStars: number; onClose: () => void }) {
  const { profile } = useCatalog();
  const [stars, setStars] = useState(existing?.stars ?? initialStars);
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function toggle(tag: string) {
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]));
  }

  async function save() {
    if (stars === 0) return setError('اختر عدد النجوم أولًا.');
    setBusy(true);
    setError('');
    // Stored in one fixed order, whatever order they were ticked in.
    const draft = { stars, comment, tags: ORDER_TAGS.map((t) => t.value as string).filter((v) => tags.includes(v)) };
    try {
      if (existing) await editReview(existing, draft);
      else await rateOrder(order, profile.id, profile.fullName, draft);
      onClose();
    } catch (e) {
      setError((e as { code?: string }).code === 'permission-denied' ? 'لا يمكنك تقييم هذا.' : 'تعذّر حفظ التقييم. حاول مرة أخرى.');
      setBusy(false);
    }
  }

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette review-panel" role="dialog" aria-modal="true" aria-label="قيّم طلبك">
        <h2>قيّم طلبك</h2>
        <p className="pmeta">{order.productName} · {order.companyName}</p>
        <StarPicker stars={stars} onChange={setStars} />
        <p className="star-label">{stars === 0 ? 'اضغط على النجوم للتقييم' : STAR_LABELS[stars]}</p>
        <div className="group-label" style={{ padding: 0 }}>ما الذي أعجبك؟ (اختياري)</div>
        <div className="chips">
          {ORDER_TAGS.map((t) => (
            <button key={t.value} type="button" aria-pressed={tags.includes(t.value)} className={`chip-link small${tags.includes(t.value) ? ' on' : ''}`} onClick={() => toggle(t.value)}>
              {t.label}
            </button>
          ))}
        </div>
        <label className="field">
          تعليق
          <textarea rows={3} maxLength={COMMENT_MAX} value={comment} placeholder="اكتب للآخرين عن تجربتك" onChange={(e) => setComment(e.target.value)} />
        </label>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn" disabled={busy} onClick={save}>{existing ? 'حفظ التعديل' : 'إرسال التقييم'}</button>
        <button className="btn ghost" disabled={busy} onClick={onClose}>إلغاء</button>
      </div>
    </div>
  );
}

/** Once delivered, the customer rates the order, or sees and edits their rating for a while. */
export function ReviewCard({ order }: { order: Order }) {
  const review = useReview(order.id);
  const [form, setForm] = useState<{ stars: number } | null>(null);

  return (
    <>
      {review ? (
        <section className="tile">
          <h2>تقييمك</h2>
          <div className="stars" style={{ fontSize: 22 }} role="img" aria-label={`${review.stars} من 5`}>
            {'★'.repeat(review.stars)}<span className="stars-off">{'★'.repeat(5 - review.stars)}</span>
          </div>
          {review.comment && <p className="prose">{review.comment}</p>}
          {review.reply && (
            <div className="reply"><strong>رد الشركة</strong><p>{review.reply}</p></div>
          )}
          {canEdit(review) && (
            <div className="location-row">
              <button className="mini-btn" onClick={() => setForm({ stars: review.stars })}>تعديل التقييم</button>
              <span className="pmeta">يمكنك تعديله حتى {formatDate(editableUntil(review))}.</span>
            </div>
          )}
        </section>
      ) : (
        <section className="tile review-prompt">
          <h2>كيف كانت تجربتك؟</h2>
          <p className="prose" style={{ marginTop: 6 }}>تقييمك يساعد العملاء الآخرين في الاختيار، ويساعد الشركة على التحسّن.</p>
          <StarPicker stars={0} onChange={(stars) => setForm({ stars })} />
          <button className="btn" onClick={() => setForm({ stars: 0 })}>قيّم</button>
        </section>
      )}
      {form && <ReviewForm order={order} existing={review} initialStars={form.stars} onClose={() => setForm(null)} />}
    </>
  );
}
