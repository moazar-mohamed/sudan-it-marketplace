import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { sdg } from '../data/format';
import { formatKm, jobDistanceKm, monthCompletedCount, monthFees, nextJob } from '../data/jobs';
import { useJob, useTechData } from '../data/TechData';
import { t } from '../i18n';
import { Icon } from '../ui/Icon';
import { StatusBadge } from '../ui/kit';
import { placeOf } from './HomePage';

/** Shown right after the technician confirms a job is finished. */
export default function DonePage() {
  const { id } = useParams();
  const job = useJob(id);
  const { jobs, location } = useTechData();
  const navigate = useNavigate();
  const withNote = (useLocation().state as { note?: boolean } | null)?.note === true;
  const here = location.status === 'on' ? location.point : null;
  const next = nextJob(jobs, here);

  return (
    <div className="app">
      <div className="scroll" style={{ display: 'flex', flexDirection: 'column' }}>
        <section className="hero" style={{ flex: 'none', padding: 'calc(56px + env(safe-area-inset-top)) 24px 88px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
          <span style={{ width: 88, height: 88, borderRadius: 44, background: 'var(--action)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 10px rgba(255,255,255,.12), 0 12px 30px rgba(0,0,0,.25)' }}>
            <svg className="ico" viewBox="0 0 24 24" aria-hidden="true" style={{ width: 44, height: 44, strokeWidth: 2.4 }}>
              <path d="m5 12 5 5L20 7" />
            </svg>
          </span>
          <h1 style={{ marginTop: 12, fontSize: 26, fontWeight: 800 }}>{t('تمت المهمة، أحسنت!')}</h1>
          {job && (
            <p style={{ fontSize: 15, opacity: 0.88 }}>
              {job.productName} · {job.customerName || t('عميل')}
            </p>
          )}
        </section>
        <main className="lift" style={{ flex: 1, padding: '0 16px calc(20px + env(safe-area-inset-bottom))', marginTop: -56, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <section className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {job && (
              <div className="row" style={{ gap: 12 }}>
                <span style={{ flex: 'none', width: 48, height: 48, borderRadius: 14, background: 'rgba(31,163,92,.14)', color: 'var(--action)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="cash" />
                </span>
                <div className="minw">
                  <div className="sub">{t('رسوم التركيب لهذه المهمة')}</div>
                  <div dir="ltr" style={{ fontSize: 24, fontWeight: 800, color: 'var(--action)', textAlign: 'end' }}>
                    +{sdg(job.installationFee)}
                  </div>
                </div>
              </div>
            )}
            <div className="grid2">
              <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t('مهام هذا الشهر')}</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{monthCompletedCount(jobs)}</div>
              </div>
              <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t('رسوم الشهر')}</div>
                <div dir="ltr" style={{ fontSize: 18, fontWeight: 800, textAlign: 'end' }}>
                  {sdg(monthFees(jobs))}
                </div>
              </div>
            </div>
            <p className="row sub" style={{ gap: 6 }}>
              <Icon name={job?.pendingSync ? 'offline' : 'bell'} small />
              {job?.pendingSync
                ? t('الإنجاز محفوظ على الجهاز، ويصل الشركة إشعار عند عودة الاتصال')
                : withNote
                  ? t('وصل الشركة إشعار بالإنجاز مع ملاحظتك')
                  : t('وصل الشركة إشعار بالإنجاز')}
            </p>
          </section>

          {next && (
            <section className="card card-b" aria-labelledby="d-next" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h2 id="d-next" className="sec">
                {t('المهمة التالية')}
              </h2>
              <div className="row">
                <span className="minw" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 16, fontWeight: 800 }}>{next.productName}</span>
                  <span style={{ fontSize: 14, color: 'var(--muted)' }}>
                    {placeOf(next)}
                    {jobDistanceKm(next, here) !== null ? ` · ${t('{0} كم', formatKm(jobDistanceKm(next, here)!))}` : ''}
                  </span>
                </span>
                <StatusBadge job={next} short />
              </div>
            </section>
          )}

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {next && (
              <button type="button" className="btn" onClick={() => navigate(`/jobs/${next.id}`, { replace: true })}>
                {t('افتح المهمة التالية')}
                <Icon name="forward" />
              </button>
            )}
            <Link className="btn-line" to="/" replace>
              {t('رجوع للرئيسية')}
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
