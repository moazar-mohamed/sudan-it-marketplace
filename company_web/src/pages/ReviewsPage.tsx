import { useMemo, useState } from 'react';
import { useCompanyData } from '../data/CompanyData';
import { replyToReview, useReviews } from '../data/company';
import { ago } from '../data/format';
import type { Review } from '../data/types';
import { Banner, Chip, Empty, Loading, PageHeader, Spinner } from '../ui/kit';
import { useToast } from '../ui/toast';

const TAG_LABEL: Record<string, string> = { quality: 'جودة', delivery: 'توصيل', punctual: 'التزام بالموعد', service: 'خدمة', price: 'سعر' };

export function ReviewsPage() {
  const { companyId } = useCompanyData();
  const reviews = useReviews(companyId);
  return (
    <main className="page">
      <PageHeader title="التقييمات" subtitle="ما يقوله العملاء عن شركتك، ويمكنك الرد عليه" />
      <ReviewsList reviews={reviews} />
    </main>
  );
}

function ReviewsList({ reviews }: { reviews: Review[] | null }) {
  const [filter, setFilter] = useState<'all' | 'noReply' | 'low'>('all');
  const stats = useMemo(() => {
    const list = (reviews ?? []).filter((r) => !r.hidden);
    const dist = [5, 4, 3, 2, 1].map((s) => list.filter((r) => r.stars === s).length);
    const avg = list.length ? list.reduce((n, r) => n + r.stars, 0) / list.length : 0;
    return { list, dist, avg };
  }, [reviews]);
  if (reviews === null) return <section className="card"><Loading /></section>;
  const shown = stats.list.filter((r) => (filter === 'noReply' ? !r.reply : filter === 'low' ? r.stars <= 2 : true));
  return (
    <div className="g2">
      <section className="card" aria-label="التقييمات">
        <div className="card-h">
          <h2>التقييمات</h2><span className="grow" />
          <div className="pills">
            <button type="button" className={`pill${filter === 'all' ? ' on' : ''}`} onClick={() => setFilter('all')}>الكل <span className="n">{stats.list.length}</span></button>
            <button type="button" className={`pill${filter === 'noReply' ? ' on' : ''}`} onClick={() => setFilter('noReply')}>بلا رد <span className="n">{stats.list.filter((r) => !r.reply).length}</span></button>
            <button type="button" className={`pill${filter === 'low' ? ' on' : ''}`} onClick={() => setFilter('low')}>1–2 نجوم <span className="n">{stats.list.filter((r) => r.stars <= 2).length}</span></button>
          </div>
        </div>
        {shown.length === 0 ? <Empty icon="star" text="لا تقييمات هنا." /> : shown.map((r) => <ReviewRow key={r.id} review={r} />)}
      </section>
      <section className="card" aria-label="ملخص التقييم">
        <div className="card-h"><h3>ملخص التقييم</h3></div>
        <div className="card-b stack" style={{ gap: 12 }}>
          <div className="row"><div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>{stats.avg ? stats.avg.toFixed(1) : '—'}</div><div><Stars n={Math.round(stats.avg)} /><div className="sub">من {stats.list.length} تقييمًا</div></div></div>
          {[5, 4, 3, 2, 1].map((s, i) => (
            <div key={s} className="row"><span style={{ width: 18 }}>{s}</span><div className={`prog grow${s <= 1 ? ' bad' : s === 2 ? ' warn' : ''}`}><i style={{ width: `${stats.list.length ? (stats.dist[i] / stats.list.length) * 100 : 0}%` }} /></div><span className="sub" style={{ width: 28 }}>{stats.dist[i]}</span></div>
          ))}
          <Banner tone="info" icon="info" tight>تصل ردودك للعملاء كإشعار.</Banner>
        </div>
      </section>
    </div>
  );
}

const Stars = ({ n }: { n: number }) => (
  <span className="stars" role="img" aria-label={`${n} من 5 نجوم`}>
    {'★'.repeat(n)}<span style={{ color: 'var(--line-strong)' }}>{'★'.repeat(5 - n)}</span>
  </span>
);

function ReviewRow({ review: r }: { review: Review }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(r.reply);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!text.trim() || text.length > 500) return;
    setBusy(true);
    try {
      const told = await replyToReview(r, text);
      toast(told ? 'نُشر الرد' : 'نُشر الرد، لكن تعذّر إرسال الإشعار', told ? 'ok' : 'info');
      setOpen(false);
    } catch { toast('تعذّر نشر الرد.', 'err'); } finally { setBusy(false); }
  };
  return (
    <div className="lr" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 8, padding: '16px 20px', background: !r.reply && r.stars <= 2 ? 'var(--warn-bg)' : undefined }}>
      <div className="row" style={{ width: '100%' }}>
        <span className="av">{(r.authorName || 'ع').slice(0, 1)}</span>
        <div className="grow"><b>{r.authorName || 'عميل'}</b><div className="sub">{r.targetName} · {ago(r.createdAt)}</div></div>
        <Stars n={r.stars} />
      </div>
      {r.tags.length > 0 && <div className="row wrap" style={{ gap: 6 }}>{r.tags.map((t) => <Chip key={t} tone={r.stars >= 4 ? 'ok' : 'n'} dot={false} small>{TAG_LABEL[t] ?? t}</Chip>)}</div>}
      {r.comment && <div>{r.comment}</div>}
      {r.reply && !open && (
        <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 14px', width: '100%' }}>
          <div className="sub b">ردّك · {ago(r.replyAt)}</div><div>{r.reply}</div>
          <button type="button" className="linkbtn" onClick={() => setOpen(true)}>تعديل الرد</button>
        </div>
      )}
      {open ? (
        <div className="fld" style={{ width: '100%' }}>
          <label htmlFor={`rp-${r.id}`}>اكتب ردًا يراه كل العملاء</label>
          <textarea id={`rp-${r.id}`} className="inp" rows={2} value={text} maxLength={500} onChange={(e) => setText(e.target.value)} autoFocus />
          <div className="row"><button type="button" className="btn p sm" disabled={!text.trim() || busy} onClick={() => void save()}>{busy && <Spinner />}نشر الرد</button><button type="button" className="btn sm" onClick={() => setOpen(false)}>إلغاء</button></div>
        </div>
      ) : !r.reply && <button type="button" className="btn sm" onClick={() => setOpen(true)}>رد</button>}
    </div>
  );
}
