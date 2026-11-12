import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useProfile } from '../auth/AuthProvider';
import { addNote, deleteNote, markNoticeRead } from '../data/actions';
import { arrived, dateTime, dayMonthTime, dayTime, sdg } from '../data/format';
import { chatUnread, completedAt, directionsUrl, formatKm, initial, jobDistanceKm, jobPoint, shortId } from '../data/jobs';
import { mapNote } from '../data/mappers';
import { useJob, useTechData } from '../data/TechData';
import { NOTE_MAX, type Job, type Note } from '../data/types';
import { t } from '../i18n';
import { Icon } from '../ui/Icon';
import { useJobFlow } from '../ui/JobFlow';
import { BackButton, JobSteps, Loading, OfflineStrip, StatusBadge, telHref } from '../ui/kit';
import { useToast } from '../ui/toast';

export default function JobPage() {
  const { id } = useParams();
  const job = useJob(id);
  const { jobsReady, notices } = useTechData();

  // Opening the job reads its notices (new job, payment confirmed, cancelled).
  useEffect(() => {
    if (!id) return;
    for (const n of notices) if (n.orderId === id && !n.isRead) markNoticeRead(n.id);
  }, [id, notices]);

  if (!job) {
    return (
      <div className="app">
        <header className="bar">
          <BackButton to="/jobs" label={t('رجوع إلى المهام')} />
          <div className="bar-title">
            <h1>{t('مهمة تركيب')}</h1>
          </div>
        </header>
        {jobsReady ? (
          <div className="center">
            <p style={{ color: 'var(--text)', fontWeight: 700 }}>{t('هذه المهمة غير موجودة أو لم تعد مُسندة إليك.')}</p>
            <Link className="btn-line" to="/jobs" style={{ minWidth: 200 }}>
              {t('افتح مهامي')}
            </Link>
          </div>
        ) : (
          <Loading />
        )}
      </div>
    );
  }
  return <JobDetails job={job} />;
}

function JobDetails({ job }: { job: Job }) {
  const { location, chats } = useTechData();
  const flow = useJobFlow(job);
  const toast = useToast();
  const here = location.status === 'on' ? location.point : null;
  const km = jobDistanceKm(job, here);
  const cancelled = job.orderStatus === 'cancelled';
  const completed = job.orderStatus === 'completed';
  const waiting = !cancelled && !completed && job.paymentStatus !== 'confirmed';
  const pickup = job.deliveryMethod === 'pickup';
  const directions = directionsUrl(job);
  const chat = chats[job.id];
  const unread = chatUnread(chat);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(job.deliveryAddress);
      toast(t('نُسخ العنوان.'), 'ok');
    } catch {
      toast(t('تعذّر النسخ. اضغط مطوّلًا على العنوان لنسخه.'), 'err');
    }
  };

  return (
    <div className="app">
      <header className="bar">
        <BackButton to="/jobs" label={t('رجوع إلى المهام')} />
        <div className="bar-title">
          <h1 style={{ fontSize: 17 }}>
            {t('مهمة تركيب')} <span className="num">#{shortId(job.id)}</span>
          </h1>
          <p>
            {arrived(job.createdAt)} · {job.paymentStatus === 'confirmed' ? t('الدفع مؤكد') : t('بانتظار تأكيد الدفع')}
          </p>
        </div>
        <StatusBadge job={job} short onBar />
      </header>
      <OfflineStrip />
      <main className="scroll pad">
        {cancelled && (
          <section role="alert" className="strip err" style={{ borderRadius: 18, padding: 14, gap: 12 }}>
            <span style={{ flex: 'none', width: 40, height: 40, borderRadius: 20, background: 'rgba(211,47,47,.14)', color: 'var(--err-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" />
            </span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--err-ink)' }}>{t('ألغت الشركة هذه المهمة')}</div>
              {job.cancelNote && <div style={{ fontSize: 14, lineHeight: 1.6 }}>{t('ملاحظة الشركة: {0}', job.cancelNote)}</div>}
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                {dayMonthTime(job.cancelledAt ?? job.updatedAt ?? job.createdAt)} · {t('لا تحتاج للذهاب إلى العميل')}
              </div>
            </div>
          </section>
        )}

        {!cancelled && (
          <section className="card" aria-labelledby="t-progress" style={{ padding: '14px 14px 12px' }}>
            <h2 id="t-progress" className="sec" style={{ marginBottom: 12 }}>
              {t('تقدّم المهمة')}
            </h2>
            <JobSteps job={job} large />
          </section>
        )}

        <section className="card" aria-labelledby="t-customer" style={{ overflow: 'hidden' }}>
          {!pickup && <MiniMap job={job} km={km} />}
          <div className="card-b stack">
            <h2 id="t-customer" className="sec">
              {t('العميل والموقع')}
            </h2>
            <div className="row" style={{ gap: 12 }}>
              <span style={{ flex: 'none', width: 44, height: 44, borderRadius: 22, background: 'var(--soft)', color: 'var(--soft-ink)', fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden="true">
                {initial(job.customerName || t('عميل'))}
              </span>
              <div className="minw">
                <div style={{ fontSize: 16, fontWeight: 800 }}>{job.customerName || t('عميل')}</div>
                {job.contactPhone && (
                  <a href={telHref(job.contactPhone)} dir="ltr" style={{ display: 'block', fontSize: 14, color: 'var(--muted)', textAlign: 'end' }}>
                    {job.contactPhone}
                  </a>
                )}
              </div>
            </div>
            {!pickup && (
              <>
                <div className="row" style={{ alignItems: 'flex-start', gap: 8, fontSize: 15, lineHeight: 1.6 }}>
                  <Icon name="pin" small />
                  <span style={{ userSelect: 'text' }}>{job.deliveryAddress || t('لم يكتب العميل عنوانًا. اتصل به لتأكيد المكان.')}</span>
                </div>
                <div className="grid3">
                  {directions ? (
                    <a className="btn-navy" href={directions} target="_blank" rel="noreferrer">
                      <Icon name="pin" small />
                      {t('الاتجاهات')}
                    </a>
                  ) : (
                    <button type="button" className="btn-navy" disabled style={{ opacity: 0.5 }}>
                      <Icon name="pin" small />
                      {t('الاتجاهات')}
                    </button>
                  )}
                  <CallButton phone={job.contactPhone} />
                  <button type="button" className="btn-line" onClick={copyAddress} disabled={!job.deliveryAddress}>
                    <Icon name="copy" small />
                    {t('نسخ')}
                  </button>
                </div>
              </>
            )}
            {pickup && (
              <>
                <div className="strip soft" style={{ fontSize: 14 }}>
                  <Icon name="building" />
                  <div>
                    <b>{t('العميل يستلم المنتج من الشركة.')}</b>
                    <br />
                    {t('اتصل به لتأكيد مكان التركيب قبل الذهاب.')}
                  </div>
                </div>
                {job.contactPhone && (
                  <a className="btn-navy" href={telHref(job.contactPhone)}>
                    <Icon name="phone" small />
                    {t('اتصل بالعميل')}
                  </a>
                )}
              </>
            )}
          </div>
        </section>

        <section className="card card-b stack" aria-labelledby="t-job" style={{ gap: 12 }}>
          <h2 id="t-job" className="sec">
            {t('ماذا ستركّب')}
          </h2>
          <div className="row" style={{ gap: 12 }}>
            <span className="tile" style={{ width: 56, height: 56, borderRadius: 16 }}>
              <Icon name="box" />
            </span>
            <div className="minw">
              <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.4 }}>{job.productName}</div>
              <div style={{ fontSize: 14, color: 'var(--muted)' }}>
                {t('الكمية: {0}', job.quantity)} · {pickup ? t('استلام من الشركة وتركيب') : t('توصيل وتركيب')}
              </div>
            </div>
          </div>
          <dl className="grid2" style={{ margin: 0 }}>
            <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '10px 12px' }}>
              <dt style={{ fontSize: 12, color: 'var(--muted)' }}>{t('رسوم التركيب')}</dt>
              <dd dir="ltr" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--action)', textAlign: 'end' }}>
                {sdg(job.installationFee)}
              </dd>
            </div>
            <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '10px 12px' }}>
              <dt style={{ fontSize: 12, color: 'var(--muted)' }}>{t('تاريخ الطلب')}</dt>
              <dd dir="ltr" style={{ margin: 0, fontSize: 15, fontWeight: 700, textAlign: 'end' }}>
                {dateTime(job.createdAt)}
              </dd>
            </div>
          </dl>
        </section>

        <NotesCard job={job} />

        <Link to={`/chats/${job.id}`} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="tile">
            <Icon name="chat" />
            {unread && <span className="cnt" style={{ border: '2px solid var(--surface)', minWidth: 16, height: 16, top: -4, insetInlineEnd: -4 }} aria-label={t('رسالة جديدة')} />}
          </span>
          <span className="minw" style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{t('محادثة مع الشركة')}</span>
            <span className="ell" style={{ fontSize: 13, color: unread ? 'var(--text)' : 'var(--muted)', fontWeight: unread ? 700 : 400 }}>
              {chat?.lastMessageText
                ? `${chat.lastMessageSenderRole === 'technician' ? t('أنت:') : t('الشركة:')} ${chat.lastMessageText}`
                : t('لا رسائل بعد. اسأل الشركة عن أي شيء يخص المهمة.')}
            </span>
          </span>
          <Icon name="chevron" small />
        </Link>
      </main>

      {!cancelled && (
        <footer style={{ flex: 'none', background: 'var(--surface)', borderTop: '1px solid var(--line)', padding: '12px 16px calc(16px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 -8px 24px -16px rgba(11,29,58,.25)' }}>
          {job.pendingSync && (
            <div className="strip warn" role="status" style={{ alignItems: 'center', fontWeight: 700, padding: '8px 12px' }}>
              <Icon name="offline" small />
              {job.orderStatus === 'out_for_delivery'
                ? t('«في الطريق» محفوظة على الجهاز، وستُرسل عند عودة الاتصال')
                : job.orderStatus === 'completed'
                  ? t('الإنجاز محفوظ على الجهاز، وسيُرسل عند عودة الاتصال')
                  : t('التغيير محفوظ على الجهاز، وسيُرسل عند عودة الاتصال')}
            </div>
          )}
          {flow.label && (
            <>
              <div className="row" style={{ gap: 8 }}>
                {job.contactPhone && (
                  <a href={telHref(job.contactPhone)} aria-label={t('اتصال بالعميل')} style={{ flex: 'none', width: 52, height: 52, borderRadius: 14, background: 'var(--soft)', color: 'var(--soft-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="phone" />
                  </a>
                )}
                <button type="button" className="btn big" style={{ flex: 1 }} onClick={flow.open}>
                  {flow.label}
                  <Icon name={flow.label === t('إنهاء المهمة') ? 'check' : 'forward'} />
                </button>
              </div>
              <p className="sub" style={{ textAlign: 'center' }}>
                {flow.hint}
              </p>
            </>
          )}
          {waiting && (
            <div className="strip warn" style={{ padding: '12px 14px' }}>
              <Icon name="clock" />
              <div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{t('بانتظار تأكيد الشركة للدفع')}</div>
                <div>{t('يظهر زر بدء التوصيل هنا بعد التأكيد، ويصلك إشعار.')}</div>
              </div>
            </div>
          )}
          {completed && (
            <div className="strip ok" style={{ padding: '12px 14px', alignItems: 'center' }}>
              <Icon name="check" />
              <div className="minw">
                <div style={{ fontSize: 15, fontWeight: 800 }}>{t('اكتملت المهمة')}</div>
                <div>
                  {dayMonthTime(completedAt(job))} · {t('رسوم التركيب {0}', sdg(job.installationFee))}
                </div>
              </div>
            </div>
          )}
        </footer>
      )}
      {flow.sheet}
    </div>
  );
}

function CallButton({ phone }: { phone: string }) {
  if (!phone) {
    return (
      <button type="button" className="btn-line" disabled>
        <Icon name="phone" small />
        {t('اتصال')}
      </button>
    );
  }
  return (
    <a className="btn-line" href={telHref(phone)}>
      <Icon name="phone" small />
      {t('اتصال')}
    </a>
  );
}

/** A small map of the delivery point (needs the network); without it, the drawn grid and a pin. */
function MiniMap({ job, km }: { job: Job; km: number | null }) {
  const { online } = useTechData();
  const point = jobPoint(job);
  const d = 0.006;
  return (
    <div className={`minimap${point && online ? '' : ' grid'}`} aria-hidden="true">
      {point && online ? (
        <iframe
          title={t('خريطة موقع العميل')}
          tabIndex={-1}
          loading="lazy"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${point.longitude - d},${point.latitude - d},${point.longitude + d},${point.latitude + d}&layer=mapnik&marker=${point.latitude},${point.longitude}`}
        />
      ) : (
        <span className="pinmark" />
      )}
      {km !== null && <span className="dist">{t('{0} كم منك', formatKm(km))}</span>}
    </div>
  );
}

function NotesCard({ job }: { job: Job }) {
  const profile = useProfile();
  const { technician } = useTechData();
  const toast = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return onSnapshot(
      collection(db, 'orders', job.id, 'technicianNotes'),
      { includeMetadataChanges: true },
      (snap) => {
        const list = snap.docs.map((d) => mapNote(d.id, d.data(), d.metadata.hasPendingWrites));
        list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        setNotes(list);
      },
      () => setNotes([]),
    );
  }, [job.id]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await addNote(job, text, technician?.fullName || profile.fullName);
      setText('');
      if (r === 'queued') toast(t('الملاحظة محفوظة على الجهاز، وستُرسل عند عودة الاتصال.'));
    } catch {
      toast(t('تعذّر حفظ الملاحظة، حاول مرة أخرى.'), 'err');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (note: Note) => {
    if (!window.confirm(t('حذف هذه الملاحظة؟'))) return;
    try {
      await deleteNote(job.id, note.id);
    } catch {
      toast(t('تعذّر حذف الملاحظة.'), 'err');
    }
  };

  return (
    <section className="card card-b stack" aria-labelledby="t-notes">
      <div className="row" style={{ gap: 6 }}>
        <h2 id="t-notes" className="sec">
          {t('ملاحظاتي')}
        </h2>
        <span className="row" style={{ marginInlineStart: 'auto', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
          <Icon name="lock" small />
          {t('للشركة فقط، العميل لا يراها')}
        </span>
      </div>
      {notes.length === 0 && <p className="sub">{t('اكتب ما تريد أن تعرفه الشركة عن المهمة: موعد، قطعة ناقصة، مكان صعب…')}</p>}
      {notes.map((n) => (
        <div key={n.id} style={{ background: 'var(--surface-2)', borderRadius: 14, padding: '10px 12px', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <div className="minw">
            {n.kind === 'completion' && <span className="st ok" style={{ marginBottom: 4 }}>{t('ملاحظة الإنجاز')}</span>}
            <div style={{ fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{n.text}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{n.pending ? t('بانتظار الإرسال') : dayTime(n.createdAt)}</div>
          </div>
          {n.authorId === profile.uid && (
            <button type="button" aria-label={t('حذف الملاحظة')} onClick={() => void remove(n)} style={{ flex: 'none', width: 44, height: 44, borderRadius: 12, border: 0, background: 'transparent', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="trash" small />
            </button>
          )}
        </div>
      ))}
      <form onSubmit={add} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, border: '1px solid var(--line)', background: 'var(--surface-2)', borderRadius: 12, padding: 6 }}>
        <label htmlFor="note-new" className="sr">
          {t('ملاحظة جديدة')}
        </label>
        <textarea
          id="note-new"
          rows={2}
          maxLength={NOTE_MAX}
          placeholder={t('اكتب ملاحظة عن المهمة')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', resize: 'none', fontSize: 15, padding: '4px 6px', background: 'transparent' }}
        />
        <button type="submit" className="btn-navy" disabled={busy || !text.trim()} style={{ minHeight: 44, padding: '0 14px', fontSize: 14, opacity: busy || !text.trim() ? 0.6 : 1 }}>
          {t('إضافة')}
        </button>
      </form>
      {text.length > NOTE_MAX - 80 && (
        <span className="num sub" style={{ alignSelf: 'flex-end', fontSize: 12 }}>
          {text.length} / {NOTE_MAX}
        </span>
      )}
    </section>
  );
}
