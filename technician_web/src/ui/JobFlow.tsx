import { useCallback, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../auth/AuthProvider';
import { advanceJob, finishJob } from '../data/actions';
import { actionOf, formatKm, jobDistanceKm, shortId } from '../data/jobs';
import { useTechData } from '../data/TechData';
import { NOTE_MAX, type Job } from '../data/types';
import { t } from '../i18n';
import { Icon } from './Icon';
import { Sheet } from './kit';
import { useToast } from './toast';

const refusedText = (err: unknown): string =>
  (err as { code?: string } | null)?.code === 'permission-denied'
    ? t('رُفض التغيير. ربما غيّرت الشركة المهمة، حدّث الصفحة وتأكد من حالتها.')
    : t('تعذّر حفظ التغيير، حاول مرة أخرى.');

/** The step the job's main button takes: "start delivery" (with a confirm sheet) or "finish" (with the checklist). */
export function useJobFlow(job: Job | null): { open: () => void; sheet: ReactNode; label: string | null; hint: string | null } {
  const [which, setWhich] = useState<'start' | 'finish' | null>(null);
  const close = useCallback(() => setWhich(null), []);
  const action = job ? actionOf(job) : null;
  const label = action === 'start' ? t('بدء التوصيل للعميل') : action === 'finish' ? t('إنهاء المهمة') : null;
  const hint =
    action === 'start' ? t('الخطوة التالية: في الطريق، ثم الإنهاء') : action === 'finish' ? t('تفتح قائمة تحقق قصيرة قبل الإنهاء') : null;
  const open = useCallback(() => {
    if (action === 'start' || action === 'finish') setWhich(action);
  }, [action]);
  const sheet =
    job && which === 'start' ? <ConfirmStartSheet job={job} onClose={close} /> : job && which === 'finish' ? <FinishSheet job={job} onClose={close} /> : null;
  return { open, sheet, label, hint };
}

function ConfirmStartSheet({ job, onClose }: { job: Job; onClose: () => void }) {
  const toast = useToast();
  const { location } = useTechData();
  const [busy, setBusy] = useState(false);
  const km = jobDistanceKm(job, location.status === 'on' ? location.point : null);

  const go = async () => {
    setBusy(true);
    try {
      const result = await advanceJob(job, 'out_for_delivery');
      toast(result === 'queued' ? t('«في الطريق» محفوظة على الجهاز، وستُرسل عند عودة الاتصال') : t('أصبحت المهمة «في الطريق».'), 'ok');
      onClose();
    } catch (err) {
      toast(refusedText(err), 'err');
      setBusy(false);
    }
  };

  return (
    <Sheet title={t('تبدأ التوصيل الآن؟')} onClose={onClose}>
      {(titleId) => (
        <>
          <div className="row" style={{ gap: 12 }}>
            <span style={{ flex: 'none', width: 52, height: 52, borderRadius: 16, background: 'var(--go-bg)', color: 'var(--go)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="truck" />
            </span>
            <div>
              <h1 id={titleId} style={{ fontSize: 20, fontWeight: 800 }}>
                {t('تبدأ التوصيل الآن؟')}
              </h1>
              <p className="sub" style={{ fontSize: 14 }}>
                {t('مهمة')} <span className="num">#{shortId(job.id)}</span>
              </p>
            </div>
          </div>
          <dl style={{ margin: 0, background: 'var(--surface-2)', borderRadius: 16, padding: '4px 14px', display: 'flex', flexDirection: 'column' }}>
            <SumRow label={t('المنتج')} value={job.productName} />
            <SumRow label={t('العميل')} value={job.customerName || t('عميل')} />
            <SumRow label={t('العنوان')} value={[job.deliveryAddress || t('غير مكتوب'), km !== null ? t('{0} كم', formatKm(km)) : null].filter(Boolean).join(' · ')} last />
          </dl>
          <div className="strip warn" style={{ fontSize: 14 }}>
            <Icon name="alert" />
            <p>{t('ستتغيّر حالة الطلب إلى «في الطريق» عند العميل والشركة، ولا يمكن التراجع عن هذه الخطوة.')}</p>
          </div>
          <div className="row">
            <button type="button" className="btn-line" style={{ flex: 1 }} onClick={onClose}>
              {t('إلغاء')}
            </button>
            <button type="button" className="btn" style={{ flex: 2 }} onClick={go} disabled={busy}>
              <Icon name="truck" />
              {busy ? t('جارٍ الحفظ…') : t('نعم، أنا في الطريق')}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

function SumRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: last ? 0 : '1px solid var(--line)' }}>
      <dt style={{ flex: 'none', width: 70, fontSize: 13, color: 'var(--muted)' }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.5 }}>{value}</dd>
    </div>
  );
}

const CHECKS = [t('ركّبت المنتج وتأكدت من عمله'), t('شرحت للعميل طريقة الاستخدام'), t('سلّمت العميل الفاتورة أو الضمان')];

function FinishSheet({ job, onClose }: { job: Job; onClose: () => void }) {
  const profile = useProfile();
  const { technician } = useTechData();
  const toast = useToast();
  const navigate = useNavigate();
  const [checked, setChecked] = useState<boolean[]>([false, false, false]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const done = checked.filter(Boolean).length;
  const ready = done === CHECKS.length;

  const confirm = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      const { result, noteSaved } = await finishJob(job, note, technician?.fullName || profile.fullName);
      if (!noteSaved) toast(t('اكتملت المهمة، لكن تعذّر حفظ ملاحظتك. أضفها من «ملاحظاتي».'), 'err');
      else if (result === 'queued') toast(t('الإنجاز محفوظ على الجهاز، وسيُرسل عند عودة الاتصال.'), 'ok');
      onClose();
      navigate(`/jobs/${job.id}/done`, { replace: false, state: { note: note.trim().length > 0 } });
    } catch (err) {
      toast(refusedText(err), 'err');
      setBusy(false);
    }
  };

  return (
    <Sheet title={t('إنهاء المهمة')} onClose={onClose}>
      {(titleId) => (
        <>
          <div>
            <h1 id={titleId} style={{ fontSize: 20, fontWeight: 800 }}>
              {t('إنهاء المهمة')} <span className="num">#{shortId(job.id)}</span>
            </h1>
            <p className="sub" style={{ fontSize: 14, marginTop: 2 }}>
              {job.productName} · {job.customerName || t('عميل')}
            </p>
          </div>
          <div className="row">
            <div className="meter" aria-hidden="true">
              <span style={{ width: `${(done / CHECKS.length) * 100}%` }} />
            </div>
            <span style={{ flex: 'none', fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>{t('{0} من {1}', done, CHECKS.length)}</span>
          </div>
          <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <legend style={{ fontSize: 14, fontWeight: 700, color: 'var(--muted)', marginBottom: 8, padding: 0 }}>{t('قبل التأكيد، علّم الخطوات الثلاث')}</legend>
            {CHECKS.map((label, i) => (
              <label key={i} className={`check${checked[i] ? ' on' : ''}`}>
                <input type="checkbox" checked={checked[i]} onChange={(e) => setChecked((now) => now.map((v, j) => (j === i ? e.target.checked : v)))} />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="finish-note" style={{ fontSize: 14, fontWeight: 700, color: 'var(--muted)' }}>
              {t('ملاحظة للشركة (اختيارية)')}
            </label>
            <textarea id="finish-note" className="textarea" rows={3} maxLength={NOTE_MAX} placeholder={t('مثلاً: العميل يحتاج حبرًا إضافيًا خلال أسبوع')} value={note} onChange={(e) => setNote(e.target.value)} />
            <span className="num" style={{ fontSize: 12, color: 'var(--muted)', alignSelf: 'flex-end' }}>
              {note.length} / {NOTE_MAX}
            </span>
          </div>
          <div className="row">
            <button type="button" className="btn-line" style={{ flex: 1 }} onClick={onClose}>
              {t('إلغاء')}
            </button>
            <button type="button" className="btn" style={{ flex: 2 }} disabled={!ready || busy} onClick={confirm}>
              <Icon name="check" />
              {busy ? t('جارٍ الحفظ…') : t('تأكيد الإنجاز')}
            </button>
          </div>
          <p className="sub" style={{ marginTop: -4, textAlign: 'center' }}>
            {ready ? t('بعد التأكيد يصل الشركة إشعار، ولا يمكن التراجع.') : t('يتفعّل الزر بعد تعليم الخطوات الثلاث.')}
          </p>
        </>
      )}
    </Sheet>
  );
}
