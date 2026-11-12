import { Link } from 'react-router-dom';
import { useProfile } from '../auth/AuthProvider';
import { setAvailability } from '../data/actions';
import { money } from '../data/format';
import { actionOf, directionsUrl, firstName, formatKm, isOpenJob, jobDistanceKm, monthFees, nextJob, shortId } from '../data/jobs';
import { useTechData } from '../data/TechData';
import type { Job } from '../data/types';
import { t } from '../i18n';
import { Icon } from '../ui/Icon';
import { useJobFlow } from '../ui/JobFlow';
import { BellButton, JobSteps, OfflineStrip, SkeletonCards, StatusBadge, telHref } from '../ui/kit';
import { useToast } from '../ui/toast';

/** Where the job is: the customer and the address's first part. */
export const placeOf = (job: Job): string =>
  [job.customerName || t('عميل'), job.deliveryMethod === 'pickup' ? t('استلام من الشركة') : job.deliveryAddress.split(/[,،]/).slice(0, 2).join('،').trim()]
    .filter(Boolean)
    .join(' · ');

export function AvailabilityButton() {
  const { technician } = useTechData();
  const toast = useToast();
  if (!technician) return null;
  const on = technician.isAvailable;
  return (
    <button
      type="button"
      className="avail"
      role="switch"
      aria-checked={on}
      aria-label={t('أنا متاح للمهام')}
      onClick={() => {
        setAvailability(technician.id, !on)
          .then((r) => r === 'queued' && toast(t('حُفظ التغيير على الجهاز، وسيُرسل عند عودة الاتصال.')))
          .catch(() => toast(t('تعذّر حفظ التغيير، حاول مرة أخرى.'), 'err'));
      }}
    >
      <span className="lamp" aria-hidden="true" />
      {on ? t('متاح') : t('مشغول')}
    </button>
  );
}

export default function HomePage() {
  const profile = useProfile();
  const { technician, jobs, jobsReady, jobsError, location } = useTechData();
  const here = location.status === 'on' ? location.point : null;
  const open = jobs.filter(isOpenJob);
  const ready = open.filter((j) => actionOf(j) === 'start' || actionOf(j) === 'finish').length;
  const completed = jobs.filter((j) => j.orderStatus === 'completed').length;
  const next = nextJob(jobs, here);
  const upcoming = open.filter((j) => j.id !== next?.id).slice(0, 5);
  const name = firstName(technician?.fullName || profile.fullName);
  const available = technician?.isAvailable !== false;

  let greetLine: string;
  if (!available) greetLine = t('أنت مشغول الآن، ولن تُسند إليك مهام جديدة');
  else if (open.length === 0) greetLine = t('لا مهام جارية الآن. ستصلك المهمة الجديدة هنا وفي الإشعارات.');
  else if (open.length === 1) greetLine = ready === 1 ? t('لديك مهمة جارية واحدة، وهي جاهزة للتنفيذ') : t('لديك مهمة جارية واحدة');
  else if (ready === 0) greetLine = t('لديك {0} مهام جارية', open.length);
  else if (ready === 1) greetLine = t('لديك {0} مهام جارية، واحدة منها جاهزة للتنفيذ', open.length);
  else greetLine = t('لديك {0} مهام جارية، {1} منها جاهزة للتنفيذ', open.length, ready);

  return (
    <>
      <header className="bar">
        <img className="logo" src="/og-logo.png" alt="Sudan ICT Marketplace" />
        <div className="bar-title">
          <span dir="ltr" style={{ display: 'block', fontSize: 14, fontWeight: 800, textAlign: 'start' }} className="ell">
            Sudan ICT Marketplace
          </span>
          <p>{t('بوابة الفني')}</p>
        </div>
        <AvailabilityButton />
        <BellButton />
      </header>
      <OfflineStrip />
      <main className="scroll">
        <section className="hero" style={{ padding: '16px 16px 60px' }}>
          <h1 style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.35 }}>{name ? t('مرحبًا، {0}', name) : t('مرحبًا')}</h1>
          <p style={{ fontSize: 14, opacity: 0.88 }}>{greetLine}</p>
        </section>
        <div className="lift" style={{ padding: '0 16px 16px', marginTop: -46, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!jobsReady ? (
            <SkeletonCards count={2} height={140} />
          ) : jobsError ? (
            <div className="card card-b empty">{t('تعذّر تحميل مهامك. تأكد من الاتصال ثم حدّث الصفحة.')}</div>
          ) : next ? (
            <NextJobCard job={next} km={jobDistanceKm(next, here)} />
          ) : (
            <div className="card raised" style={{ padding: 20, textAlign: 'center' }}>
              <span className="tile" style={{ margin: '0 auto 8px', width: 52, height: 52 }}>
                <Icon name="wrench" />
              </span>
              <h2 style={{ fontSize: 17, fontWeight: 800 }}>{t('لا توجد مهمة الآن')}</h2>
              <p className="sub" style={{ fontSize: 14 }}>{t('عندما تُسند إليك الشركة مهمة تركيب تظهر هنا مباشرة.')}</p>
            </div>
          )}

          <div className="grid3" style={{ gap: 10 }}>
            <Link to="/jobs?f=open" className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.25, color: 'var(--warn)' }}>{open.length}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{t('جارية')}</span>
            </Link>
            <Link to="/jobs?f=done" className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.25, color: 'var(--brand)' }}>{completed}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{t('مكتملة')}</span>
            </Link>
            <Link to="/profile" className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column' }}>
              <span dir="ltr" style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.6, color: 'var(--action)', textAlign: 'end' }} className="ell">
                {money(monthFees(jobs))}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{t('رسوم الشهر SDG')}</span>
            </Link>
          </div>

          {upcoming.length > 0 && (
            <>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: 16, fontWeight: 800 }}>{t('المهام القادمة')}</h2>
                <Link to="/jobs" style={{ fontSize: 14, fontWeight: 700, padding: '10px 4px' }}>
                  {t('عرض الكل')}
                </Link>
              </div>
              {upcoming.map((job) => {
                const km = jobDistanceKm(job, here);
                return (
                  <Link key={job.id} to={`/jobs/${job.id}`} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="tile">
                      <Icon name={job.orderStatus === 'out_for_delivery' ? 'truck' : 'box'} />
                    </span>
                    <span className="minw" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span className="ell" style={{ fontSize: 15, fontWeight: 700 }}>
                        {job.productName}
                      </span>
                      <span className="ell" style={{ fontSize: 13, color: 'var(--muted)' }}>
                        {placeOf(job)}
                        {km !== null ? ` · ${t('{0} كم', formatKm(km))}` : ''}
                      </span>
                    </span>
                    <StatusBadge job={job} short />
                  </Link>
                );
              })}
            </>
          )}
        </div>
      </main>
    </>
  );
}

function NextJobCard({ job, km }: { job: Job; km: number | null }) {
  const flow = useJobFlow(job);
  const directions = directionsUrl(job);
  const paid = job.paymentStatus === 'confirmed';
  return (
    <section className="card raised" aria-labelledby="next-title" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <span id="next-title" className="st info">
          {t('المهمة التالية')}
        </span>
        <span className={`st ${paid ? 'ok' : 'warn'}`}>{paid ? t('الدفع مؤكد') : t('بانتظار تأكيد الدفع')}</span>
        <span style={{ marginInlineStart: 'auto', fontSize: 13, color: 'var(--muted)' }}>
          <span className="num">#{shortId(job.id)}</span>
          {km !== null ? ` · ${t('{0} كم', formatKm(km))}` : ''}
        </span>
      </div>
      <Link to={`/jobs/${job.id}`} style={{ color: 'var(--text)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.4 }}>{job.productName}</h2>
        <p style={{ marginTop: 2, fontSize: 14, color: 'var(--muted)' }}>{placeOf(job)}</p>
      </Link>
      <JobSteps job={job} />
      {flow.label ? (
        <button type="button" className="btn" onClick={flow.open}>
          {flow.label}
          <Icon name="forward" />
        </button>
      ) : (
        <div className="strip warn">
          <Icon name="clock" />
          <p>{t('بانتظار تأكيد الشركة للدفع، يظهر زر بدء التوصيل هنا بعد التأكيد.')}</p>
        </div>
      )}
      <div className="grid3">
        {directions ? (
          <a className="btn-line" href={directions} target="_blank" rel="noreferrer">
            <Icon name="pin" small />
            {t('الاتجاهات')}
          </a>
        ) : (
          <Link className="btn-line" to={`/jobs/${job.id}`}>
            <Icon name="info" small />
            {t('التفاصيل')}
          </Link>
        )}
        {job.contactPhone ? (
          <a className="btn-line" href={telHref(job.contactPhone)}>
            <Icon name="phone" small />
            {t('اتصال')}
          </a>
        ) : (
          <button type="button" className="btn-line" disabled>
            <Icon name="phone" small />
            {t('اتصال')}
          </button>
        )}
        <Link className="btn-line" to={`/chats/${job.id}`}>
          <Icon name="chat" small />
          {t('محادثة')}
        </Link>
      </div>
      {flow.sheet}
    </section>
  );
}
