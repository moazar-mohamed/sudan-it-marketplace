import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompanyData } from '../data/CompanyData';
import { PushSettings } from '../ui/PushSettings';
import { deleteNotice, describeNotice, markAllNoticesRead, markNoticeRead, noticeLook } from '../data/inbox';
import type { Notice, NoticeLook } from '../data/inbox';
import { ago } from '../data/format';
import { Icon } from '../ui/Icon';
import { Chip, Empty, Loading, PageHeader } from '../ui/kit';
import { useToast } from '../ui/toast';
import { t } from '../i18n';

const TONE: Record<NoticeLook['tone'], { bg: string; fg: string }> = {
  ok: { bg: 'var(--ok-bg)', fg: 'var(--ok)' },
  bad: { bg: 'var(--bad-bg)', fg: 'var(--bad)' },
  warn: { bg: 'var(--warn-bg)', fg: 'var(--warn)' },
  info: { bg: 'var(--brand-tint)', fg: 'var(--brand-ink)' },
};

/** Splits newest-first notices into today's and the earlier ones. */
export function splitNoticesByDay(notices: readonly Notice[], now: Date = new Date()): { today: Notice[]; earlier: Notice[] } {
  const sameDay = (d: Date | null) =>
    !d || (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate());
  return { today: notices.filter((n) => sameDay(n.createdAt)), earlier: notices.filter((n) => !sameDay(n.createdAt)) };
}

export function NotificationsPage() {
  const { notices, unreadNotices } = useCompanyData();
  const { state } = useAuth();
  const uid = state.status === 'authorized' ? state.profile.uid : null;
  const navigate = useNavigate();
  const toast = useToast();
  if (notices === null) return <main className="page"><Loading /></main>;

  const open = async (id: string, to: string, read: boolean) => {
    if (!read) await markNoticeRead(id).catch(() => undefined);
    navigate(to);
  };
  const readAll = async () => {
    try {
      await markAllNoticesRead(notices.filter((n) => !n.isRead).map((n) => n.id));
      toast(t('عُلّمت كلها مقروءة'), 'ok');
    } catch {
      toast(t('تعذّر التحديث.'), 'err');
    }
  };
  const remove = async (id: string) => {
    if (!window.confirm(t('حذف هذا التنبيه؟ سيُحذف نهائياً.'))) return;
    try {
      await deleteNotice(id);
      toast(t('حُذف التنبيه'), 'ok');
    } catch {
      toast(t('تعذّر الحذف.'), 'err');
    }
  };

  const row = (n: Notice) => {
    const v = describeNotice(n);
    const look = noticeLook(n.type);
    const tone = TONE[look.tone];
    return (
      <div key={n.id} className="lr" style={{ borderBottom: '1px solid var(--line)', background: n.isRead ? 'var(--surface)' : 'var(--brand-tint)', paddingInlineEnd: 8 }}>
        <button
          type="button"
          className="lr grow"
          style={{ border: 0, background: 'transparent', textAlign: 'start', padding: 0 }}
          onClick={() => void open(n.id, v.to, n.isRead)}
        >
          <div className="ico-c" style={{ background: tone.bg, color: tone.fg }}><Icon name={look.icon} /></div>
          <div className="grow"><div className="b">{v.title}</div><div className="sub">{v.body}</div></div>
          {!n.isRead && <Chip tone="info" dot={false} small>{t('جديد')}</Chip>}
          <span className="sub">{ago(n.createdAt)}</span>
        </button>
        <button type="button" className="btn sm g" aria-label={t('حذف التنبيه')} title={t('حذف التنبيه')} onClick={() => void remove(n.id)}>
          <Icon name="trash" size="sm" />
        </button>
      </div>
    );
  };

  const { today, earlier } = splitNoticesByDay(notices);
  const heading = (text: string) => <div className="sub" style={{ padding: '10px 16px 4px', fontWeight: 700 }}>{text}</div>;

  return (
    <main className="page">
      <PageHeader
        title={t('التنبيهات')}
        subtitle={unreadNotices ? t('{0} غير مقروءة', unreadNotices) : t('لا تنبيهات جديدة')}
        actions={<button type="button" className="btn" disabled={unreadNotices === 0} onClick={() => void readAll()}><Icon name="check" />{t('تعليم الكل كمقروء')}</button>}
      />
      {uid && <PushSettings uid={uid} />}
      <section className="card" aria-label={t('التنبيهات')}>
        {notices.length === 0 ? (
          <Empty icon="bell" text={t('لا تنبيهات بعد. سيصلك هنا كل طلب جديد وتقييم وطلب خدمة.')} />
        ) : (
          <>
            {today.length > 0 && heading(t('اليوم'))}
            {today.map(row)}
            {earlier.length > 0 && heading(t('سابقًا'))}
            {earlier.map(row)}
          </>
        )}
        <div className="foot"><span className="sub">{t('يظهر آخر 50 تنبيه.')}</span><Link to="/" className="btn sm g">{t('اليوم')}</Link></div>
      </section>
    </main>
  );
}
