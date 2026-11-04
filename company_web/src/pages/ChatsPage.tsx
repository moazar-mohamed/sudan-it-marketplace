import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompanyData } from '../data/CompanyData';
import { ago } from '../data/format';
import { chatSubject, isUnreadChat } from '../data/inbox';
import { ChatPanel } from '../ui/ChatPanel';
import { Chip, Empty, Loading, PageHeader } from '../ui/kit';
import { t } from '../i18n';

export function ChatsPage() {
  const { state } = useAuth();
  const { chats, unreadChats } = useCompanyData();
  const [params, setParams] = useSearchParams();
  const senderName = state.status === 'authorized' ? state.profile.fullName || t('الشركة') : t('الشركة');
  if (chats === null) return <main className="page"><Loading /></main>;

  const selected = chats.find((c) => c.id === params.get('c')) ?? null;

  return (
    <main className="page">
      <PageHeader title={t('المحادثات')} subtitle={unreadChats ? t('{0} تنتظر ردك', unreadChats) : t('لا محادثات تنتظر ردك')} />
      {chats.length === 0 ? (
        <section className="card"><Empty icon="chat" text={t('لا محادثات بعد. تبدأ المحادثة مع كل طلب، ومن زر «تواصل» في صفحة المنتج.')} /></section>
      ) : (
        <div className="g2r">
          <section className="card" aria-label={t('قائمة المحادثات')} style={{ maxHeight: 640, overflow: 'auto' }}>
            {chats.map((c) => {
              const unread = isUnreadChat(c);
              return (
                <button
                  key={c.id}
                  type="button"
                  className="lr"
                  aria-current={selected?.id === c.id}
                  style={{ width: '100%', border: 0, borderBottom: '1px solid var(--line)', background: selected?.id === c.id ? 'var(--brand-tint)' : 'var(--surface)', textAlign: 'start' }}
                  onClick={() => setParams({ c: c.id }, { replace: true })}
                >
                  <span className="av">{(c.customerName || t('ع')).slice(0, 1)}</span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className={unread ? 'b' : ''}>{c.customerName || t('عميل')}</div>
                    <div className="sub ellipsis">{chatSubject(c)} · {c.lastMessageText}</div>
                  </div>
                  <div style={{ textAlign: 'end' }}>
                    <div className="sub">{ago(c.lastMessageAt)}</div>
                    {unread && <Chip tone="info" dot={false} small>{t('جديدة')}</Chip>}
                  </div>
                </button>
              );
            })}
          </section>
          <div className="stack t">
            {selected ? (
              <>
                <ChatPanel chatId={selected.id} senderName={senderName} title={`${selected.customerName || t('عميل')} · ${chatSubject(selected)}`} />
                {selected.orderId && <Link to={`/orders/${selected.orderId}`} className="btn">{t('فتح الطلب')}</Link>}
              </>
            ) : (
              <section className="card"><Empty icon="chat" text={t('اختر محادثة من القائمة.')} /></section>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
