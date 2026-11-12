import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { arrived, dayMonth, sdg } from '../data/format';
import { completedAt, formatKm, isOpenJob, jobDistanceKm, searchJobs, shortId } from '../data/jobs';
import { useTechData } from '../data/TechData';
import type { Job } from '../data/types';
import { t } from '../i18n';
import { Icon } from '../ui/Icon';
import { BellButton, OfflineStrip, SkeletonCards, StatusBadge } from '../ui/kit';
import { placeOf } from './HomePage';

type Filter = 'all' | 'open' | 'done' | 'cancelled';
type Sort = 'nearest' | 'newest';

const STATUS_WORDS = {
  processing: t('قيد التجهيز'),
  out_for_delivery: t('في الطريق'),
  completed: t('مكتملة'),
  cancelled: t('ملغاة'),
  waiting: t('بانتظار الدفع'),
};

const DONE_SHOWN = 5;

export default function JobsPage() {
  const { jobs, jobsReady, jobsError, location, askLocation, newJobIds } = useTechData();
  const [params, setParams] = useSearchParams();
  const fromParam = params.get('f');
  const filter: Filter = fromParam === 'open' || fromParam === 'done' || fromParam === 'cancelled' ? fromParam : 'all';
  const [queryText, setQueryText] = useState('');
  const here = location.status === 'on' ? location.point : null;
  const [sortChoice, setSortChoice] = useState<Sort | null>(null);
  const sort: Sort = here ? sortChoice ?? 'nearest' : 'newest';
  const [menu, setMenu] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  const counts = useMemo(
    () => ({
      all: jobs.length,
      open: jobs.filter(isOpenJob).length,
      done: jobs.filter((j) => j.orderStatus === 'completed').length,
      cancelled: jobs.filter((j) => j.orderStatus === 'cancelled').length,
    }),
    [jobs],
  );

  const { found, suggestion } = useMemo(() => {
    const r = searchJobs(jobs, queryText, STATUS_WORDS);
    return { found: r.jobs, suggestion: r.suggestion };
  }, [jobs, queryText]);
  const searching = queryText.trim().length > 0;

  const order = (list: Job[]): Job[] => {
    if (searching) return list; // best match first
    if (sort === 'nearest') {
      return [...list].sort((a, b) => {
        const ak = jobDistanceKm(a, here);
        const bk = jobDistanceKm(b, here);
        if (ak !== null && bk !== null) return ak - bk;
        if (ak !== null) return -1;
        if (bk !== null) return 1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
    }
    return list;
  };

  const openJobs = order(found.filter(isOpenJob));
  const doneJobs = [...found.filter((j) => j.orderStatus === 'completed')].sort((a, b) =>
    searching ? 0 : completedAt(b).getTime() - completedAt(a).getTime(),
  );
  const cancelledJobs = found.filter((j) => j.orderStatus === 'cancelled');
  const show = { open: filter === 'all' || filter === 'open', done: filter === 'all' || filter === 'done', cancelled: filter === 'all' || filter === 'cancelled' };
  const shownCount = (show.open ? openJobs.length : 0) + (show.done ? doneJobs.length : 0) + (show.cancelled ? cancelledJobs.length : 0);
  const doneVisible = allDone || filter === 'done' || searching ? doneJobs : doneJobs.slice(0, DONE_SHOWN);

  const chips: { id: Filter; label: string }[] = [
    { id: 'all', label: t('الكل') },
    { id: 'open', label: t('جارية') },
    { id: 'done', label: t('مكتملة') },
    { id: 'cancelled', label: t('ملغاة') },
  ];

  const pick = (f: Filter) => {
    const next = new URLSearchParams(params);
    if (f === 'all') next.delete('f');
    else next.set('f', f);
    setParams(next, { replace: true });
  };

  return (
    <>
      <header className="bar">
        <div className="bar-title" style={{ paddingInlineStart: 4 }}>
          <h1 style={{ fontSize: 19 }}>{t('مهامي')}</h1>
          <p>{counts.all === 1 ? t('مهمة تركيب واحدة مُسندة إليك') : t('{0} مهمة تركيب مُسندة إليك', counts.all)}</p>
        </div>
        <BellButton />
      </header>
      <OfflineStrip />
      <div style={{ flex: 'none', padding: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label className="search">
          <Icon name="search" />
          <span className="sr">{t('بحث في المهام')}</span>
          <input type="search" placeholder={t('ابحث في مهامك')} value={queryText} onChange={(e) => setQueryText(e.target.value)} />
          {searching && (
            <button type="button" aria-label={t('مسح البحث')} onClick={() => setQueryText('')} style={{ border: 0, background: 'none', color: 'var(--muted)', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" small />
            </button>
          )}
        </label>
        {location.status === 'off' && (
          <div className="strip soft" role="status" style={{ alignItems: 'center', fontWeight: 600 }}>
            <Icon name="pin" />
            <span className="minw">{t('الموقع غير مفعّل، لذلك لا تظهر المسافات ولا ترتيب «الأقرب»')}</span>
            <button type="button" className="btn-navy" style={{ minHeight: 40, padding: '0 12px', fontSize: 13 }} onClick={askLocation}>
              {t('تفعيل')}
            </button>
          </div>
        )}
        <div role="toolbar" aria-label={t('تصفية المهام')} className="chips">
          {chips.map((c) => (
            <button key={c.id} type="button" className="chip" aria-pressed={filter === c.id} onClick={() => pick(c.id)}>
              {c.label} <span className="num">{counts[c.id]}</span>
            </button>
          ))}
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="sub" role="status">
            {searching ? t('{0} نتيجة', shownCount) : shownCount === 1 ? t('مهمة واحدة') : t('{0} مهمة', shownCount)}
          </span>
          <div className="menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="btn-line"
              aria-haspopup="menu"
              aria-expanded={menu}
              disabled={!here || searching}
              title={!here ? t('فعّل الموقع لترتيب المهام بالأقرب') : undefined}
              onClick={() => setMenu(!menu)}
              style={{ minHeight: 44, fontSize: 14 }}
            >
              <Icon name="sort" small />
              {searching ? t('ترتيب: الأنسب') : sort === 'nearest' ? t('ترتيب: الأقرب') : t('ترتيب: الأحدث')}
              <Icon name="down" small />
            </button>
            {menu && (
              <div className="menu" role="menu">
                {(['nearest', 'newest'] as Sort[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="menuitemradio"
                    aria-checked={sort === s}
                    onClick={() => {
                      setSortChoice(s);
                      setMenu(false);
                    }}
                  >
                    {s === 'nearest' ? t('الأقرب') : t('الأحدث')}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <main className="scroll" style={{ padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!jobsReady ? (
          <SkeletonCards count={3} />
        ) : jobsError ? (
          <div className="card empty">{t('تعذّر تحميل مهامك. تأكد من الاتصال ثم حدّث الصفحة.')}</div>
        ) : shownCount === 0 ? (
          <div className="card empty">
            {searching ? (
              <>
                <p>{t('لا توجد مهمة تطابق «{0}».', queryText.trim())}</p>
                {suggestion && (
                  <button type="button" className="mini" style={{ margin: '10px auto 0' }} onClick={() => setQueryText(suggestion)}>
                    {t('هل تقصد «{0}»؟', suggestion)}
                  </button>
                )}
              </>
            ) : filter === 'open' ? (
              t('لا مهام جارية الآن.')
            ) : filter === 'done' ? (
              t('لم تُكمل أي مهمة بعد.')
            ) : filter === 'cancelled' ? (
              t('لا توجد مهام ملغاة.')
            ) : (
              t('لم تُسند إليك أي مهمة بعد. ستصلك هنا وفي الإشعارات.')
            )}
          </div>
        ) : null}

        {show.open && openJobs.length > 0 && (
          <>
            <h2 className="sec" style={{ marginTop: 6 }}>
              {t('جارية')} · <span className="num">{openJobs.length}</span>
            </h2>
            {openJobs.map((job) => {
              const km = jobDistanceKm(job, here);
              return (
                <Link key={job.id} to={`/jobs/${job.id}`} className="card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span className="row" style={{ gap: 8 }}>
                    <StatusBadge job={job} />
                    {newJobIds.has(job.id) && <span className="st new">{t('جديدة')}</span>}
                    <span className="num" style={{ marginInlineStart: 'auto', fontSize: 13, color: 'var(--muted)' }}>
                      #{shortId(job.id)}
                    </span>
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.4 }}>{job.productName}</span>
                  <span className="row" style={{ gap: 4, fontSize: 14, color: 'var(--muted)' }}>
                    <Icon name="pin" small />
                    <span className="minw ell">{placeOf(job)}</span>
                    {km !== null && <span style={{ flex: 'none', fontWeight: 700, color: 'var(--brand)' }}>{t('{0} كم', formatKm(km))}</span>}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                    {arrived(job.createdAt)}
                    {job.paymentStatus === 'confirmed' ? ` · ${t('الدفع مؤكد')}` : ''}
                    {job.pendingSync ? ` · ${t('بانتظار الإرسال')}` : ''}
                  </span>
                </Link>
              );
            })}
          </>
        )}

        {show.done && doneJobs.length > 0 && (
          <>
            <h2 className="sec" style={{ marginTop: 10 }}>
              {t('مكتملة')} · <span className="num">{doneJobs.length}</span>
            </h2>
            {doneVisible.map((job) => (
              <Link key={job.id} to={`/jobs/${job.id}`} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ flex: 'none', width: 38, height: 38, borderRadius: 19, background: 'var(--ok-bg)', color: 'var(--ok)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="check" small />
                </span>
                <span className="minw" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="ell" style={{ fontSize: 15, fontWeight: 700 }}>
                    {job.productName}
                  </span>
                  <span className="ell" style={{ fontSize: 13, color: 'var(--muted)' }}>
                    {placeOf(job)} · {dayMonth(completedAt(job))}
                  </span>
                </span>
                <span dir="ltr" style={{ flex: 'none', fontSize: 14, fontWeight: 800, color: 'var(--action)' }}>
                  {sdg(job.installationFee)}
                </span>
              </Link>
            ))}
            {doneVisible.length < doneJobs.length && (
              <button type="button" className="btn-line" onClick={() => setAllDone(true)}>
                {t('عرض {0} مهمة مكتملة أخرى', doneJobs.length - doneVisible.length)}
              </button>
            )}
          </>
        )}

        {show.cancelled && cancelledJobs.length > 0 && (
          <>
            <h2 className="sec" style={{ marginTop: 10 }}>
              {t('ملغاة')} · <span className="num">{cancelledJobs.length}</span>
            </h2>
            {cancelledJobs.map((job) => (
              <Link key={job.id} to={`/jobs/${job.id}`} className="card flat" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="row" style={{ gap: 8 }}>
                  <span className="st off">{t('ملغاة من الشركة')}</span>
                  <span className="num" style={{ marginInlineStart: 'auto', fontSize: 13, color: 'var(--muted)' }}>
                    #{shortId(job.id)}
                  </span>
                </span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--muted)' }}>{job.productName}</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {placeOf(job)} · {dayMonth(job.cancelledAt ?? job.updatedAt ?? job.createdAt)}
                </span>
              </Link>
            ))}
          </>
        )}
      </main>
    </>
  );
}
