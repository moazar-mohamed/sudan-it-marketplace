import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { markNoticeRead } from '../data/actions';
import { dayTime, sameDay } from '../data/format';
import { chatUnread } from '../data/jobs';
import { useTechData } from '../data/TechData';
import type { Notice } from '../data/types';
import { t } from '../i18n';
import { Icon, type IconName } from '../ui/Icon';
import { BackButton } from '../ui/kit';
import { PushCard } from '../ui/PushCard';

interface Item {
  key: string;
  href: string;
  icon: IconName;
  iconBg: string;
  iconFg: string;
  title: string;
  body: string;
  at: Date;
  unread: boolean;
  notice?: Notice;
}

/** The words of a technician notification: the notification carries only its type and the product (as in the app). */
function wordsOf(n: Notice, placeOf: (orderId: string) => string): Pick<Item, 'icon' | 'iconBg' | 'iconFg' | 'title' | 'body'> {
  const place = placeOf(n.orderId);
  const product = [n.productName, place].filter(Boolean).join(' · ');
  switch (n.type) {
    case 'technician_assigned':
      return { icon: 'wrench', iconBg: 'var(--soft)', iconFg: 'var(--soft-ink)', title: t('مهمة جديدة أُسندت إليك'), body: product };
    case 'job_ready':
      return { icon: 'check', iconBg: 'var(--ok-bg)', iconFg: 'var(--ok)', title: t('أكدت الشركة الدفع'), body: t('{0}. المهمة جاهزة، ابدأ التوصيل متى كنت جاهزًا.', product) };
    case 'job_cancelled':
      return { icon: 'close', iconBg: 'var(--err-bg)', iconFg: 'var(--err-ink)', title: t('ألغت الشركة مهمة'), body: t('{0}. لا داعي للذهاب.', product) };
    default:
      return { icon: 'bell', iconBg: 'var(--soft)', iconFg: 'var(--soft-ink)', title: t('إشعار من الشركة'), body: product };
  }
}

export default function NotificationsPage() {
  const { notices, chats, jobs } = useTechData();

  const items = useMemo<Item[]>(() => {
    const byId = new Map(jobs.map((j) => [j.id, j]));
    const placeOf = (orderId: string) => byId.get(orderId)?.customerName ?? '';
    const list: Item[] = notices.map((n) => ({
      key: n.id,
      href: `/jobs/${n.orderId}`,
      at: n.createdAt,
      unread: !n.isRead,
      notice: n,
      ...wordsOf(n, placeOf),
    }));
    // Company messages are not stored as notifications; an unread conversation shows here too.
    for (const [orderId, chat] of Object.entries(chats)) {
      if (!chat || !chatUnread(chat) || !chat.lastMessageAt) continue;
      const job = byId.get(orderId);
      list.push({
        key: `chat_${orderId}`,
        href: `/chats/${orderId}`,
        icon: 'chat',
        iconBg: '#063b73',
        iconFg: '#fff',
        title: t('رسالة من الشركة'),
        body: [job?.productName, chat.lastMessageText].filter(Boolean).join(': '),
        at: chat.lastMessageAt,
        unread: true,
      });
    }
    return list.sort((a, b) => b.at.getTime() - a.at.getTime());
  }, [notices, chats, jobs]);

  const now = new Date();
  const today = items.filter((i) => sameDay(i.at, now));
  const older = items.filter((i) => !sameDay(i.at, now));
  const anyUnread = notices.some((n) => !n.isRead);

  const row = (i: Item) => (
    <Link
      key={i.key}
      to={i.href}
      className="card"
      onClick={() => i.notice && !i.notice.isRead && markNoticeRead(i.notice.id)}
      style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'flex-start', background: i.unread ? 'var(--unread)' : undefined }}
    >
      <span style={{ flex: 'none', width: 42, height: 42, borderRadius: 21, background: i.iconBg, color: i.iconFg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={i.icon} />
      </span>
      <span className="minw" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>{i.title}</span>
        {i.body && <span style={{ fontSize: 14, color: 'var(--body-2)', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{i.body}</span>}
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{dayTime(i.at)}</span>
      </span>
      {i.unread && <span aria-label={t('غير مقروء')} role="img" style={{ flex: 'none', width: 10, height: 10, borderRadius: 5, background: 'var(--action)', marginTop: 6 }} />}
    </Link>
  );

  return (
    <div className="app">
      <header className="bar">
        <BackButton to="/" label={t('رجوع إلى الرئيسية')} />
        <div className="bar-title">
          <h1>{t('الإشعارات')}</h1>
        </div>
        {anyUnread && (
          <button type="button" className="ib text" onClick={() => notices.filter((n) => !n.isRead).forEach((n) => markNoticeRead(n.id))}>
            {t('قراءة الكل')}
          </button>
        )}
      </header>
      <main className="scroll" style={{ padding: '14px 16px calc(16px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PushCard />
        {items.length === 0 && <div className="card empty">{t('لا إشعارات بعد. ستصلك هنا المهام الجديدة وتأكيد الدفع والإلغاء.')}</div>}
        {today.length > 0 && <h2 className="sec">{t('اليوم')}</h2>}
        {today.map(row)}
        {older.length > 0 && (
          <h2 className="sec" style={{ marginTop: today.length ? 10 : 0 }}>
            {t('أقدم')}
          </h2>
        )}
        {older.map(row)}
      </main>
    </div>
  );
}
