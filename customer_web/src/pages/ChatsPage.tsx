import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, Skeleton } from '../components/Bits';
import { Icon, PATHS } from '../components/Icon';
import {
  activityAt,
  ChatRefused,
  chatSubject,
  isInquiry,
  isUnread,
  markRead,
  MESSAGE_MAX,
  openProductInquiry,
  openServiceInquiry,
  readByCompany,
  sendMessage,
  useConversation,
  useConversations,
  useMessages,
} from '../data/chats';
import { useCatalog } from '../data/DataProvider';
import { formatDate, formatDateTime } from '../data/format';
import { useOrder } from '../data/hooks';
import { ORDER_STATUS } from '../data/orders';
import { REQUEST_STATUS, useServiceRequest } from '../data/serviceRequests';
import type { ChatMessage, Conversation } from '../data/types';
import { t } from '../i18n';

const timeOf = (d: Date): string => formatDateTime(d).split(' ').slice(1).join(' ');

function ChatList({ items, activeId }: { items: Conversation[]; activeId: string }) {
  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const term = search.trim().toLowerCase();
  const shown = items.filter(
    (c) =>
      (!unreadOnly || isUnread(c)) &&
      (term === '' || `${c.companyName} ${chatSubject(c)} ${c.lastMessageText}`.toLowerCase().includes(term)),
  );
  return (
    <section className="tile chat-list" aria-label={t('قائمة المحادثات')}>
      <h1>{t('المحادثات')}</h1>
      <input className="chat-search" type="search" placeholder={t('ابحث في المحادثات')} aria-label={t('ابحث في المحادثات')} value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="chips">
        <button className={`chip-link small${unreadOnly ? '' : ' on'}`} onClick={() => setUnreadOnly(false)}>{t('الكل')}</button>
        <button className={`chip-link small${unreadOnly ? ' on' : ''}`} onClick={() => setUnreadOnly(true)}>{t('غير المقروءة')}</button>
      </div>
      <div className="chat-rows">
        {shown.length === 0 && <div className="empty">{t('لا توجد محادثات هنا.')}</div>}
        {shown.map((c) => {
          const unread = isUnread(c);
          return (
            <Link key={c.id} to={`/chats/${c.id}`} className={`chat-row${c.id === activeId ? ' on' : ''}${unread ? ' unread' : ''}`}>
              <span className="avatar">{[...c.companyName][0] ?? t('؟')}</span>
              <span className="grow chat-row-text">
                <strong>{c.companyName}</strong>
                <span className="pmeta">{chatSubject(c)}</span>
                <span className="chat-last">
                  {c.lastMessageText
                    ? `${c.lastMessageSenderRole === 'customer' ? t('أنت: ') : ''}${c.lastMessageText}`
                    : t('لا توجد رسائل بعد')}
                </span>
              </span>
              <span className="chat-row-side">
                <span className="pmeta">{formatDate(activityAt(c))}</span>
                {unread && <span className="chat-dot" role="img" aria-label={t('غير مقروءة')} />}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/** What the conversation is about, with its live status, one click from its page. */
function ChatContext({ conversation }: { conversation: Conversation }) {
  const { links } = useCatalog();
  const { order } = useOrder(conversation.orderId ?? '');
  const { request } = useServiceRequest(conversation.serviceRequestId);
  const subject = chatSubject(conversation);

  if (conversation.orderId) {
    const status = order ? ORDER_STATUS[order.orderStatus] : null;
    return (
      <Link to={`/orders/${conversation.orderId}`} className="chat-context">
        <Icon d={PATHS.box} size={18} />
        <span className="grow">{t('طلب:')}{' '}{subject}</span>
        {status && <span className={`status ${status.tone}`}>{status.label}</span>}
      </Link>
    );
  }
  if (conversation.serviceRequestId) {
    const status = request ? REQUEST_STATUS[request.status] : null;
    return (
      <Link to={`/requests/${conversation.serviceRequestId}`} className="chat-context">
        <Icon d={PATHS.box} size={18} />
        <span className="grow">{t('طلب خدمة:')}{' '}{subject}</span>
        {status && <span className={`status ${status.tone}`}>{status.label}</span>}
      </Link>
    );
  }
  const serviceId = links.find((l) => l.id === conversation.companyServiceId)?.serviceId;
  const to = conversation.productId ? `/product/${conversation.productId}` : serviceId ? `/service/${serviceId}` : null;
  const body = (
    <>
      <Icon d={PATHS.box} size={18} />
      <span className="grow">{subject}</span>
      <span className="status info">{t('استفسار قبل الطلب')}</span>
    </>
  );
  return to ? <Link to={to} className="chat-context">{body}</Link> : <div className="chat-context">{body}</div>;
}

function Bubble({ message, conversation, mine }: { message: ChatMessage; conversation: Conversation; mine: boolean }) {
  const read = mine && readByCompany(conversation, message);
  return (
    <div className={`bubble${mine ? ' mine' : ''}`}>
      <p>{message.text}</p>
      <span className="bubble-meta">
        <span dir="ltr">{timeOf(message.createdAt)}</span>
        {mine && (
          <span className={read ? 'tick read' : 'tick'} role="img" aria-label={message.pending ? t('جارٍ الإرسال') : read ? t('قرأتها الشركة') : t('تم الإرسال')}>
            {message.pending ? '…' : read ? '✓✓' : '✓'}
          </span>
        )}
      </span>
    </div>
  );
}

function Messages({ conversation }: { conversation: Conversation }) {
  const { profile } = useCatalog();
  const { messages, loaded, failed, hasOlder, loadingOlder, loadOlder } = useMessages(conversation.id);
  const box = useRef<HTMLDivElement>(null);
  const before = useRef({ height: 0, last: '' });
  const nearBottom = useRef(true);

  // Older messages keep the reader where they are; a new one follows them down.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const last = messages[messages.length - 1]?.id ?? '';
    if (last === before.current.last && before.current.height > 0) el.scrollTop += el.scrollHeight - before.current.height;
    else if (nearBottom.current || messages[messages.length - 1]?.senderId === profile.id) el.scrollTop = el.scrollHeight;
    before.current = { height: el.scrollHeight, last };
  }, [messages, profile.id]);

  // A short first page may not fill the box, and then nothing could scroll.
  useEffect(() => {
    const el = box.current;
    if (el && hasOlder && !loadingOlder && el.scrollHeight <= el.clientHeight) loadOlder();
  }, [hasOlder, loadingOlder, loadOlder, messages]);

  function onScroll() {
    const el = box.current;
    if (!el) return;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (el.scrollTop < 160 && hasOlder) loadOlder();
  }

  if (failed) return <div className="chat-messages"><ErrorState /></div>;
  if (!loaded) return <div className="chat-messages"><Skeleton height={200} /></div>;
  if (messages.length === 0) return <div className="chat-messages"><div className="empty">{t('لا توجد رسائل بعد. اكتب لبدء المحادثة.')}</div></div>;

  let day = '';
  return (
    <div className="chat-messages" ref={box} onScroll={onScroll} role="log" aria-label={t('الرسائل')}>
      {loadingOlder && <div className="pmeta center">{t('جارٍ تحميل الرسائل الأقدم…')}</div>}
      {messages.map((m) => {
        const thisDay = formatDate(m.createdAt);
        const newDay = thisDay !== day;
        day = thisDay;
        return (
          <div key={m.id} className="bubble-row">
            {newDay && <div className="chat-day">{thisDay}</div>}
            <Bubble message={m} conversation={conversation} mine={m.senderRole === 'customer'} />
          </div>
        );
      })}
    </div>
  );
}

function Composer({ conversation }: { conversation: Conversation }) {
  const { profile } = useCatalog();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // The text stays in the box until it has really gone.
  async function send() {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setError('');
    try {
      await sendMessage(conversation, profile.id, message);
      setText('');
    } catch (e) {
      setError(e instanceof ChatRefused ? e.message : t('تعذر إرسال الرسالة. يرجى المحاولة مرة أخرى.'));
    } finally {
      setSending(false);
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="chat-composer">
      {error && <div className="error" role="alert">{error}</div>}
      <div className="chat-input">
        <textarea rows={1} maxLength={MESSAGE_MAX} placeholder={t('اكتب رسالة')} aria-label={t('اكتب رسالة')} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} />
        <button className="btn-solid" disabled={sending || text.trim() === ''} onClick={send}>{t('إرسال')}</button>
      </div>
    </div>
  );
}

function ChatPanel({ id }: { id: string }) {
  const { conversation, loaded } = useConversation(id);
  const location = useLocation();
  const note = (location.state as { note?: string } | null)?.note;
  const unread = conversation !== null && isUnread(conversation);

  // Keeps the read marker current while the conversation is open.
  useEffect(() => {
    if (unread) void markRead(id);
  }, [id, unread]);

  if (!loaded) return <section className="tile chat-panel"><Skeleton height={300} /></section>;
  if (!conversation) {
    return (
      <section className="tile chat-panel">
        <EmptyState title={t('لم يتم العثور على هذه المحادثة.')}>
          <Link to="/chats" className="pill">{t('المحادثات')}</Link>
        </EmptyState>
      </section>
    );
  }
  return (
    <section className="tile chat-panel" aria-label={t('محادثة مع {0}', conversation.companyName)}>
      <header className="chat-head">
        <Link to="/chats" className="icon-btn chat-back" aria-label={t('كل المحادثات')}><Icon d={PATHS.arrow} size={18} /></Link>
        <strong className="grow">
          {isInquiry(conversation) || !conversation.companyId
            ? conversation.companyName
            : <Link to={`/company/${conversation.companyId}`}>{conversation.companyName}</Link>}
        </strong>
      </header>
      <ChatContext conversation={conversation} />
      {note && <div className="ok-note">{note}</div>}
      <Messages key={conversation.id} conversation={conversation} />
      <Composer key={`c-${conversation.id}`} conversation={conversation} />
    </section>
  );
}

/** Opens the conversation a "Contact" button asked for, then replaces itself with it. */
function useOpenInquiry(): string {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { products, links, companies, services, profile, loading } = useCatalog();
  const [error, setError] = useState('');
  const productId = params.get('product');
  const offerId = params.get('offer');

  useEffect(() => {
    if ((!productId && !offerId) || loading) return;
    let live = true;
    async function open(): Promise<string> {
      if (productId) {
        const product = products.find((p) => p.id === productId);
        if (!product) throw new ChatRefused(t('لا يمكنك مراسلة هذه الشركة الآن.'));
        return openProductInquiry(profile.id, profile.fullName, product);
      }
      const offer = links.find((l) => l.id === offerId);
      const company = companies.find((c) => c.id === offer?.companyId);
      const service = services.find((s) => s.id === offer?.serviceId);
      if (!offer || !company || !service) throw new ChatRefused(t('لا يمكنك مراسلة هذه الشركة الآن.'));
      return openServiceInquiry(profile.id, profile.fullName, offer.id, company.id, company.name, service.name);
    }
    open().then(
      (id) => live && navigate(`/chats/${id}`, { replace: true }),
      (e) => live && setError(e instanceof ChatRefused ? e.message : t('تعذر بدء المحادثة. يرجى المحاولة مرة أخرى.')),
    );
    return () => {
      live = false;
    };
  }, [productId, offerId, loading, products, links, companies, services, profile, navigate]);

  return error;
}

export function ChatsPage() {
  const { id = '' } = useParams();
  const { profile } = useCatalog();
  const { items, error } = useConversations(profile.id);
  const openError = useOpenInquiry();
  const conversations = useMemo(() => items ?? [], [items]);

  if (error) return <main className="stack"><ErrorState /></main>;
  if (items === null) return <main className="stack"><Skeleton height={420} /></main>;
  if (items.length === 0 && !id) {
    return (
      <main className="stack narrow">
        <h1 className="page-title">{t('المحادثات')}</h1>
        {openError && <div className="error" role="alert">{openError}</div>}
        <EmptyState title={t('لا توجد محادثات بعد')} message={t('اضغط «تواصل» في صفحة أي منتج أو خدمة، أو اطلب شيئاً، وستظهر محادثتك مع الشركة هنا.')}>
          <Link to="/browse" className="pill">{t('تصفح السوق')}</Link>
        </EmptyState>
      </main>
    );
  }

  return (
    <main className={`chat-layout${id ? ' open' : ''}`}>
      <ChatList items={conversations} activeId={id} />
      {id ? (
        <ChatPanel id={id} />
      ) : (
        <section className="tile chat-panel chat-idle">
          {openError ? <div className="error" role="alert">{openError}</div> : <div className="empty">{t('اختر محادثة من القائمة.')}</div>}
        </section>
      )}
    </main>
  );
}
