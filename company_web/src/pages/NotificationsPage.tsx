import { Link, useNavigate } from 'react-router-dom';
import { useCompanyData } from '../data/CompanyData';
import { describeNotice, markAllNoticesRead, markNoticeRead } from '../data/inbox';
import { ago } from '../data/format';
import { Icon } from '../ui/Icon';
import { Chip, Empty, Loading, PageHeader } from '../ui/kit';
import { useToast } from '../ui/toast';
import { t } from '../i18n';

export function NotificationsPage() {
  const { notices, unreadNotices } = useCompanyData();
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

  return (
    <main className="page">
      <PageHeader
        title={t('التنبيهات')}
        subtitle={unreadNotices ? t('{0} غير مقروءة', unreadNotices) : t('لا تنبيهات جديدة')}
        actions={<button type="button" className="btn" disabled={unreadNotices === 0} onClick={() => void readAll()}><Icon name="check" />{t('تعليم الكل كمقروء')}</button>}
      />
      <section className="card" aria-label={t('التنبيهات')}>
        {notices.length === 0 ? (
          <Empty icon="bell" text={t('لا تنبيهات بعد. سيصلك هنا كل طلب جديد وتقييم وطلب خدمة.')} />
        ) : (
          notices.map((n) => {
            const v = describeNotice(n);
            return (
              <button
                key={n.id}
                type="button"
                className="lr"
                style={{ width: '100%', border: 0, borderBottom: '1px solid var(--line)', background: n.isRead ? 'var(--surface)' : 'var(--brand-tint)', textAlign: 'start' }}
                onClick={() => void open(n.id, v.to, n.isRead)}
              >
                <div className="ico-c" style={{ background: n.isRead ? 'var(--neutral-bg)' : 'var(--surface)' }}><Icon name="bell" /></div>
                <div className="grow"><div className="b">{v.title}</div><div className="sub">{v.body}</div></div>
                {!n.isRead && <Chip tone="info" dot={false} small>{t('جديد')}</Chip>}
                <span className="sub">{ago(n.createdAt)}</span>
              </button>
            );
          })
        )}
        <div className="foot"><span className="sub">{t('يظهر آخر 100 تنبيه.')}</span><Link to="/" className="btn sm g">{t('اليوم')}</Link></div>
      </section>
    </main>
  );
}
