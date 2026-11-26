import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState, ErrorState, Skeleton } from '../components/Bits';
import { BusyLabel } from '../components/BusyLabel';
import { Icon, PATHS } from '../components/Icon';
import { JumpToLatest, useJumpToLatest } from '../components/JumpToLatest';
import { PageTitle } from '../components/PageTitle';
import { useAccount } from '../data/DataProvider';
import { formatDate, formatDateTime } from '../data/format';
import { useOrder } from '../data/hooks';
import { shortOrderId } from '../data/orders';
import {
  markTechChatRead,
  sendTechMessage,
  TECH_MESSAGE_MAX,
  techChatOpen,
  techChatUnread,
  useTechChat,
  useTechMessages,
} from '../data/techChat';
import type { Order } from '../data/types';
import { t } from '../i18n';

const timeOf = (d: Date): string => formatDateTime(d).split(' ').slice(1).join(' ');

function Messages({ orderId, technicianName, open }: { orderId: string; technicianName: string; open: boolean }) {
  const { messages, loaded, failed } = useTechMessages(orderId);
  const box = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const items = useMemo(() => messages.map((m) => ({ id: m.id, mine: m.senderRole === 'customer' })), [messages]);
  const jumper = useJumpToLatest(box, items);

  // The newest message stays in view while the reader is at it (or wrote it);
  // someone reading older ones stays where they are and gets the jump button.
  useLayoutEffect(() => {
    const el = box.current;
    if (el && (nearBottom.current || items[items.length - 1]?.mine)) el.scrollTop = el.scrollHeight;
  }, [items]);

  function onScroll() {
    const el = box.current;
    if (!el) return;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    jumper.onScroll();
  }

  if (failed) return <div className="chat-messages"><ErrorState /></div>;
  if (!loaded) return <div className="chat-messages"><Skeleton height={200} /></div>;
  if (messages.length === 0) {
    return <div className="chat-messages"><div className="empty">{open ? t('لا توجد رسائل بعد. اكتب للفني لبدء المحادثة.') : t('لم تُكتب رسائل في هذا الطلب.')}</div></div>;
  }

  let day = '';
  return (
    <div className="chat-messages" ref={box} onScroll={onScroll} role="log" aria-label={t('الرسائل')}>
      {messages.map((m) => {
        const thisDay = formatDate(m.createdAt);
        const newDay = thisDay !== day;
        day = thisDay;
        const mine = m.senderRole === 'customer';
        return (
          <div key={m.id} className="bubble-row">
            {newDay && <div className="chat-day">{thisDay}</div>}
            <div className={`bubble${mine ? ' mine' : ''}`}>
              {!mine && <strong className="bubble-name">{m.senderName.trim() || technicianName}</strong>}
              <p>{m.text}</p>
              <span className="bubble-meta">
                <span dir="ltr">{timeOf(m.createdAt)}</span>
                {mine && m.pending && <span className="tick" role="img" aria-label={t('جارٍ الإرسال')}>…</span>}
              </span>
            </div>
          </div>
        );
      })}
      <JumpToLatest show={jumper.show} unseen={jumper.unseen} onJump={jumper.jump} />
    </div>
  );
}

function Composer({ order, existing }: { order: Order; existing: boolean }) {
  const profile = useAccount();
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
      await sendTechMessage(order, profile.id, message, existing);
      setText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('تعذر إرسال الرسالة. يرجى المحاولة مرة أخرى.'));
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
        <textarea rows={1} maxLength={TECH_MESSAGE_MAX} placeholder={t('اكتب رسالة')} aria-label={t('اكتب رسالة')} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} />
        <button className="btn-solid" disabled={sending || text.trim() === ''} aria-busy={sending} aria-label={sending ? t('جارٍ الإرسال…') : undefined} onClick={send}><BusyLabel busy={sending}>{t('إرسال')}</BusyLabel></button>
      </div>
    </div>
  );
}

/** The customer's conversation with the technician of one order (`/orders/:id/technician`). */
export function TechChatPage() {
  const { id = '' } = useParams();
  const { order, loaded } = useOrder(id);
  const { chat, loaded: chatLoaded } = useTechChat(id);
  const unread = techChatUnread(chat);

  // Keeps the read marker current while the conversation is open.
  useEffect(() => {
    if (unread) void markTechChatRead(id);
  }, [id, unread]);

  if (!loaded) return <main className="stack narrow"><Skeleton height={420} /></main>;
  if (!order || order.technicianId === null) {
    return (
      <main className="stack narrow">
        <EmptyState title={order ? t('لم تُسند الشركة فنيًا لهذا الطلب بعد.') : t('تعذر تحميل الطلب')}>
          <Link to={order ? `/orders/${order.id}` : '/orders'} className="pill">{order ? t('العودة إلى الطلب') : t('طلباتي')}</Link>
        </EmptyState>
      </main>
    );
  }

  const name = order.technicianName.trim() || t('الفني');
  const open = techChatOpen(order);
  return (
    <main className="stack narrow">
      <PageTitle title={t('محادثة مع {0}', name)} />
      <section className="tile chat-panel tech-chat" aria-label={t('محادثة مع {0}', name)}>
        <header className="chat-head">
          <Link to={`/orders/${order.id}`} className="icon-btn chat-back" style={{ display: 'flex' }} aria-label={t('العودة إلى الطلب')}><Icon d={PATHS.arrow} size={18} /></Link>
          <strong className="grow">{name}</strong>
          <span className="pmeta">{t('فني الشركة')}</span>
        </header>
        <Link to={`/orders/${order.id}`} className="chat-context">
          <Icon d={PATHS.box} size={16} />
          <span className="grow">{t('طلب:')}{' '}{order.productName}</span>
          <span className="pmeta" dir="ltr">#{shortOrderId(order.id)}</span>
        </Link>
        <div className="note tech-chat-note">
          {open
            ? t('الشركة تطّلع على هذه المحادثة، ولا تظهر فيها أرقام الهواتف.')
            : t('انتهت هذه المحادثة باكتمال الطلب أو إلغائه.')}
        </div>
        <Messages orderId={order.id} technicianName={name} open={open} />
        {open && chatLoaded && <Composer order={order} existing={chat !== null} />}
      </section>
    </main>
  );
}
