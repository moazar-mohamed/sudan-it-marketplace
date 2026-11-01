import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmptyState, ErrorState, Skeleton } from '../components/Bits';
import { useCatalog } from '../data/DataProvider';
import { formatDate } from '../data/format';
import { useMyReports } from '../data/hooks';
import {
  DETAILS_MAX,
  ORDER_REF_MAX,
  REPORT_REASONS,
  REPORT_STATUS,
  reportReasonLabel,
  ReportLimitReached,
  SUBJECT_MAX,
  submitReport,
} from '../data/reports';

export function ReportFormPage() {
  const nav = useNavigate();
  const { profile } = useCatalog();
  const [reason, setReason] = useState<string>(REPORT_REASONS[0].value);
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [orderRef, setOrderRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (subject.trim() === '') return setError('اكتب موضوعاً.');
    if (details.trim() === '') return setError('صف المشكلة.');
    setBusy(true);
    setError('');
    try {
      await submitReport(profile, { reason, subject, details, orderRef });
      nav('/reports?sent=1', { replace: true });
    } catch (err) {
      setError(err instanceof ReportLimitReached ? 'يمكنك إرسال 5 بلاغات كل 24 ساعة. يرجى المحاولة لاحقاً.' : 'حدث خطأ. يرجى المحاولة مرة أخرى.');
      setBusy(false);
    }
  }

  return (
    <main className="stack narrow">
      <h1 className="page-title">الإبلاغ عن مشكلة</h1>
      <form className="tile" onSubmit={submit} noValidate>
        <p className="prose" style={{ marginTop: 0 }}>أخبرنا بما حدث. يقرأ فريق المنصة كل بلاغ ويرد عليك في «بلاغاتي».</p>
        <fieldset className="plain">
          <legend>ما موضوع البلاغ؟</legend>
          <div className="chips">
            {REPORT_REASONS.map((r) => (
              <label key={r.value} className={`chip-link${reason === r.value ? ' on' : ''}`}>
                <input className="sr-only" type="radio" name="reason" checked={reason === r.value} onChange={() => setReason(r.value)} />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="field">
          الموضوع
          <input value={subject} maxLength={SUBJECT_MAX} placeholder="بإيجاز" onChange={(e) => setSubject(e.target.value)} />
        </label>
        <label className="field">
          ماذا حدث؟
          <textarea rows={5} value={details} maxLength={DETAILS_MAX} placeholder="اشرح ما حدث ومتى ومع أي شركة أو طلب." onChange={(e) => setDetails(e.target.value)} />
        </label>
        <label className="field">
          رقم الطلب (اختياري)
          <input value={orderRef} maxLength={ORDER_REF_MAX} onChange={(e) => setOrderRef(e.target.value)} dir="ltr" />
        </label>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn" type="submit" disabled={busy}>إرسال البلاغ</button>
      </form>
    </main>
  );
}

export function MyReportsPage() {
  const { profile } = useCatalog();
  const { items, error } = useMyReports(profile.id);
  const sent = new URLSearchParams(window.location.search).get('sent') === '1';

  return (
    <main className="stack narrow">
      <div className="section-title" style={{ margin: 0 }}>
        <h1 className="page-title">بلاغاتي</h1>
        {items && items.length > 0 && <Link to="/reports/new" className="more">الإبلاغ عن مشكلة</Link>}
      </div>
      {sent && <div className="ok-note" role="status">تم إرسال بلاغك. سنرد عليك في «بلاغاتي».</div>}
      {error ? (
        <ErrorState />
      ) : items === null ? (
        <Skeleton height={200} />
      ) : items.length === 0 ? (
        <EmptyState title="لم ترسل أي بلاغ.">
          <Link to="/reports/new" className="pill">الإبلاغ عن مشكلة</Link>
        </EmptyState>
      ) : (
        items.map((report) => {
          const status = REPORT_STATUS[report.status] ?? REPORT_STATUS.new;
          const replied = report.resolution.trim() !== '';
          return (
            <article key={report.id} className="tile report">
              <header>
                <strong className="grow">{report.subject}</strong>
                <span className={`status ${status.tone}`}>{status.label}</span>
              </header>
              <div className="pmeta">{reportReasonLabel(report.reason)} · {formatDate(report.createdAt)}</div>
              <p>{report.details}</p>
              <div className="reply">
                <strong>رد فريق المنصة</strong>
                <p className={replied ? undefined : 'pmeta'}>{replied ? report.resolution : 'لا رد بعد.'}</p>
              </div>
            </article>
          );
        })
      )}
    </main>
  );
}
