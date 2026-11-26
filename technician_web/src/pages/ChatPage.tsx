import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useProfile } from '../auth/AuthProvider';
import { markChatRead, sendCustomerMessage, sendJobMessage } from '../data/actions';
import { clock, dayMonth, sameDay } from '../data/format';
import { isOpenJob, shortId } from '../data/jobs';
import { mapChat, mapMessage } from '../data/mappers';
import { useJob, useTechData } from '../data/TechData';
import { MESSAGE_MAX, type ChatKind, type ChatMessage, type JobChat } from '../data/types';
import { t } from '../i18n';
import { Icon } from '../ui/Icon';
import { JumpToLatest, useChatScroll } from '../ui/JumpToLatest';
import { BackButton, Loading, OfflineStrip, StatusBadge } from '../ui/kit';
import { useToast } from '../ui/toast';

const QUICK = [t('وصلت للعميل'), t('العميل لا يرد'), t('أحتاج قطعة إضافية')];
const QUICK_CUSTOMER = [t('أنا في الطريق إليك'), t('وصلت، أنا عند الباب'), t('متى يناسبك الموعد؟')];

/** The customer conversation of a job, read live by this page (also once the job is closed). */
function useCustomerChat(id: string | undefined): JobChat | null | undefined {
  const [state, setState] = useState<{ id?: string; chat: JobChat | null | undefined }>({ chat: undefined });
  useEffect(() => {
    if (!id) return;
    return onSnapshot(
      doc(db, 'customerTechChats', id),
      (snap) => setState({ id, chat: snap.exists() ? mapChat(snap.id, snap.data()) : null }),
      () => setState({ id, chat: null }),
    );
  }, [id]);
  return state.id === id ? state.chat : undefined;
}

/**
 * A job's conversation: with the company (kind "company", /chats/:id) or with
 * the customer (kind "customer", /jobs/:id/customer). The customer one is
 * open only while the job is, and the company reads it.
 */
export default function ChatPage({ kind = 'company' }: { kind?: ChatKind }) {
  const { id } = useParams();
  const job = useJob(id);
  const { jobsReady, chats: companyChats, company, technician } = useTechData();
  const customerChat = useCustomerChat(kind === 'customer' ? id : undefined);
  const forCustomer = kind === 'customer';
  const collectionName = forCustomer ? 'customerTechChats' : 'jobChats';
  const profile = useProfile();
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLElement>(null);
  const chat = forCustomer ? customerChat : id ? companyChats[id] : undefined;
  const exists = Boolean(chat);

  useEffect(() => {
    if (!id || !exists) {
      setMessages(exists ? null : []);
      return;
    }
    return onSnapshot(
      query(collection(db, collectionName, id, 'messages'), orderBy('createdAt')),
      { includeMetadataChanges: true },
      (snap) => setMessages(snap.docs.map((d) => mapMessage(d.id, d.data(), d.metadata.hasPendingWrites)).filter((m): m is ChatMessage => m !== null)),
      () => setMessages([]),
    );
  }, [id, exists, collectionName]);

  // Opening the conversation (and each new message from the company while it is open) reads it.
  const lastAt = chat?.lastMessageAt?.getTime() ?? 0;
  const lastFromOther = Boolean(chat?.lastMessageSenderRole) && chat?.lastMessageSenderRole !== 'technician';
  useEffect(() => {
    if (id && exists && lastFromOther) markChatRead(id, kind);
  }, [id, exists, lastAt, lastFromOther, kind]);

  const items = useMemo(() => (messages ?? []).map((m) => ({ id: m.id, mine: m.senderRole === 'technician' })), [messages]);
  const scroll = useChatScroll(listRef, items);

  const send = async (value: string) => {
    if (!job || !value.trim()) return;
    if (value.trim().length > MESSAGE_MAX) {
      toast(t('الرسالة طويلة جدًا.'), 'err');
      return;
    }
    setBusy(true);
    try {
      const name = technician?.fullName || profile.fullName;
      await (forCustomer ? sendCustomerMessage(job, value, name, exists) : sendJobMessage(job, value, name, exists));
      setText('');
    } catch (err) {
      toast((err as { code?: string } | null)?.code === 'permission-denied' ? t('لا يمكن إرسال رسائل في هذه المهمة الآن.') : t('تعذّر إرسال الرسالة، حاول مرة أخرى.'), 'err');
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(text);
  };

  const companyName = company?.name || job?.companyName || t('الشركة');
  const back = forCustomer && job ? '/jobs/' + job.id : '/chats';
  const backLabel = forCustomer ? t('رجوع إلى المهمة') : t('رجوع إلى المحادثات');
  const writable = !forCustomer || (job !== null && isOpenJob(job));
  const quick = forCustomer ? QUICK_CUSTOMER : QUICK;

  if (!job) {
    return (
      <div className="app">
        <header className="bar">
          <BackButton to={back} label={backLabel} />
          <div className="bar-title">
            <h1>{forCustomer ? t('محادثة العميل') : t('محادثة الشركة')}</h1>
          </div>
        </header>
        {jobsReady ? <div className="center">{t('هذه المهمة غير موجودة أو لم تعد مُسندة إليك.')}</div> : <Loading />}
      </div>
    );
  }

  let lastDay: Date | null = null;
  return (
    <div className="app" style={{ background: 'var(--surface-2)' }}>
      <header className="bar">
        <BackButton to={back} label={backLabel} />
        <span style={{ flex: 'none', width: 40, height: 40, borderRadius: 20, background: '#fff', color: '#063b73', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden="true">
          <Icon name={forCustomer ? 'user' : 'building'} />
        </span>
        <div className="bar-title">
          <h1 style={{ fontSize: 16 }}>{forCustomer ? job.customerName || t('عميل') : companyName}</h1>
          <p style={{ color: '#c3d2e4', opacity: 1 }}>
            {forCustomer ? t('محادثة مع العميل') : t('محادثة مهمة')} <span className="num">#{shortId(job.id)}</span>
          </p>
        </div>
      </header>
      <OfflineStrip />
      <Link to={`/jobs/${job.id}`} style={{ flex: 'none', color: 'var(--text)', background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="tile" style={{ width: 36, height: 36, borderRadius: 10 }}>
          <Icon name="box" small />
        </span>
        <span className="minw ell" style={{ fontSize: 13, fontWeight: 700 }}>
          {forCustomer ? job.productName : job.productName + ' · ' + (job.customerName || t('عميل'))}
        </span>
        <StatusBadge job={job} short />
      </Link>
      <main ref={listRef} onScroll={scroll.onScroll} aria-label={t('الرسائل')} aria-live="polite" className="scroll" style={{ padding: '14px 14px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ alignSelf: 'center', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', background: 'var(--surface)', borderRadius: 999, padding: '4px 12px' }}>
          <Icon name={forCustomer ? 'info' : 'lock'} small />
          {forCustomer ? t('الشركة تطّلع على هذه المحادثة، ولا تظهر فيها أرقام الهواتف') : t('بينك وبين الشركة فقط، العميل لا يراها')}
        </p>
        {messages === null && <Loading />}
        {messages?.length === 0 && (
          <p className="empty">
            {!writable
              ? t('لم تُكتب رسائل في هذه المهمة.')
              : forCustomer
                ? t('لا رسائل بعد. اكتب للعميل، أو اختر ردًا سريعًا.')
                : t('لا رسائل بعد. اكتب للشركة، أو اختر ردًا سريعًا.')}
          </p>
        )}
        {messages?.map((m) => {
          const showDay = !lastDay || !sameDay(lastDay, m.createdAt);
          lastDay = m.createdAt;
          const mine = m.senderRole === 'technician';
          return (
            <div key={m.id} style={{ display: 'contents' }}>
              {showDay && (
                <p style={{ alignSelf: 'center', margin: '4px 0', fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
                  {sameDay(m.createdAt, new Date()) ? t('اليوم') : dayMonth(m.createdAt)}
                </p>
              )}
              <div className={`bubble ${mine ? 'me' : 'them'}`}>
                <div className="tx">{m.text}</div>
                <div className="tm">{m.pending ? t('بانتظار الإرسال') : clock(m.createdAt)}</div>
              </div>
            </div>
          );
        })}
        <JumpToLatest show={scroll.show} unseen={scroll.unseen} onJump={scroll.jump} />
      </main>
      {!writable && (
        <div className="strip soft" style={{ flex: 'none', margin: 0, borderRadius: 0 }}>
          <Icon name="info" />
          <p>{t('انتهت هذه المحادثة باكتمال الطلب أو إلغائه.')}</p>
        </div>
      )}
      {writable && (
      <>
      <div role="group" aria-label={t('ردود سريعة')} className="chips" style={{ flex: 'none', gap: 8, padding: '8px 14px' }}>
        {quick.map((q) => (
          <button key={q} type="button" className="qr" disabled={busy} onClick={() => void send(q)}>
            {q}
          </button>
        ))}
      </div>
      <form onSubmit={submit} style={{ flex: 'none', background: 'var(--surface)', borderTop: '1px solid var(--line)', padding: '10px 12px calc(14px + env(safe-area-inset-bottom))', display: 'flex', alignItems: 'center', gap: 8 }}>
        <label htmlFor="chat-input" className="sr">
          {forCustomer ? t('رسالة للعميل') : t('رسالة للشركة')}
        </label>
        <input
          id="chat-input"
          type="text"
          autoComplete="off"
          maxLength={MESSAGE_MAX}
          placeholder={t('اكتب رسالة')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ flex: 1, minWidth: 0, height: 48, border: '1px solid var(--line)', background: 'var(--surface-2)', borderRadius: 24, padding: '0 16px', fontSize: 15, outline: 'none' }}
        />
        <button type="submit" aria-label={t('إرسال')} disabled={busy || !text.trim()} style={{ flex: 'none', width: 48, height: 48, borderRadius: 24, border: 0, background: 'var(--action)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: busy || !text.trim() ? 0.6 : 1 }}>
          <Icon name="send" />
        </button>
      </form>
      </>
      )}
    </div>
  );
}
