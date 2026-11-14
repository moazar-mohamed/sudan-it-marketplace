import { useState } from 'react';
import { useAccount } from '../data/DataProvider';
import { formatDate } from '../data/format';
import { useReview } from '../data/hooks';
import { canEdit, COMMENT_MAX, editableUntil, editReview, rateSubject, STAR_LABELS } from '../data/reviews';
import type { ReviewSubject } from '../data/reviews';
import type { Review } from '../data/types';
import { t } from '../i18n';
import { BusyLabel } from './BusyLabel';

function StarPicker({ stars, onChange }: { stars: number; onChange: (n: number) => void }) {
  return (
    <div className="star-picker" role="radiogroup" aria-label={t('التقييم')}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={stars === n}
          aria-label={t('{0} من 5 نجوم', n)}
          className={n <= stars ? 'on' : ''}
          onClick={() => onChange(n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function ReviewForm({ subject, existing, initialStars, onClose }: { subject: ReviewSubject; existing: Review | null; initialStars: number; onClose: () => void }) {
  const profile = useAccount();
  const [stars, setStars] = useState(existing?.stars ?? initialStars);
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function toggle(tag: string) {
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]));
  }

  async function save() {
    if (stars === 0) return setError(t('اختر عدد النجوم أولًا.'));
    setBusy(true);
    setError('');
    // Stored in one fixed order, whatever order they were ticked in.
    const draft = { stars, comment, tags: subject.tags.map((t) => t.value).filter((v) => tags.includes(v)) };
    try {
      if (existing) await editReview(existing, draft);
      else await rateSubject(subject, profile.id, profile.fullName, draft);
      onClose();
    } catch (e) {
      setError((e as { code?: string }).code === 'permission-denied' ? t('لا يمكنك تقييم هذا.') : t('تعذّر حفظ التقييم. حاول مرة أخرى.'));
      setBusy(false);
    }
  }

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette review-panel" role="dialog" aria-modal="true" aria-label={t('قيّم طلبك')}>
        <h2>{t('قيّم طلبك')}</h2>
        <p className="pmeta">{subject.targetName} · {subject.companyName}</p>
        <StarPicker stars={stars} onChange={setStars} />
        <p className="star-label">{stars === 0 ? t('اضغط على النجوم للتقييم') : STAR_LABELS[stars]}</p>
        <div className="group-label" style={{ padding: 0 }}>{t('ما الذي أعجبك؟ (اختياري)')}</div>
        <div className="chips">
          {subject.tags.map((t) => (
            <button key={t.value} type="button" aria-pressed={tags.includes(t.value)} className={`chip-link small${tags.includes(t.value) ? ' on' : ''}`} onClick={() => toggle(t.value)}>
              {t.label}
            </button>
          ))}
        </div>
        <label className="field">
          {t('تعليق')}
          <textarea rows={3} maxLength={COMMENT_MAX} value={comment} placeholder={t('اكتب للآخرين عن تجربتك')} onChange={(e) => setComment(e.target.value)} />
        </label>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn" disabled={busy} aria-busy={busy} onClick={save}><BusyLabel busy={busy} busyText={existing ? t('جارٍ الحفظ…') : t('جارٍ الإرسال…')}>{existing ? t('حفظ التعديل') : t('إرسال التقييم')}</BusyLabel></button>
        <button className="btn ghost" disabled={busy} onClick={onClose}>{t('إلغاء')}</button>
      </div>
    </div>
  );
}

/** Once done, the customer rates it, or sees and edits their rating for a while. */
export function ReviewCard({ subject }: { subject: ReviewSubject }) {
  const review = useReview(subject.id);
  const [form, setForm] = useState<{ stars: number } | null>(null);

  return (
    <>
      {review ? (
        <section className="tile">
          <h2>{t('تقييمك')}</h2>
          <div className="stars" style={{ fontSize: 22 }} role="img" aria-label={t('{0} من 5', review.stars)}>
            {'★'.repeat(review.stars)}<span className="stars-off">{'★'.repeat(5 - review.stars)}</span>
          </div>
          {review.comment && <p className="prose">{review.comment}</p>}
          {review.reply && (
            <div className="reply"><strong>{t('رد الشركة')}</strong><p>{review.reply}</p></div>
          )}
          {canEdit(review) && (
            <div className="location-row">
              <button className="mini-btn" onClick={() => setForm({ stars: review.stars })}>{t('تعديل التقييم')}</button>
              <span className="pmeta">{t('يمكنك تعديله حتى')}{' '}{formatDate(editableUntil(review))}.</span>
            </div>
          )}
        </section>
      ) : (
        <section className="tile review-prompt">
          <h2>{t('كيف كانت تجربتك؟')}</h2>
          <p className="prose" style={{ marginTop: 6 }}>{t('تقييمك يساعد العملاء الآخرين في الاختيار، ويساعد الشركة على التحسّن.')}</p>
          <StarPicker stars={0} onChange={(stars) => setForm({ stars })} />
          <button className="btn" onClick={() => setForm({ stars: 0 })}>{t('قيّم')}</button>
        </section>
      )}
      {form && <ReviewForm subject={subject} existing={review} initialStars={form.stars} onClose={() => setForm(null)} />}
    </>
  );
}
