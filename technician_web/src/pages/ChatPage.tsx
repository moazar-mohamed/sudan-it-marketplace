import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useProfile } from '../auth/AuthProvider';
import { markChatRead, sendJobMessage } from '../data/actions';
import { clock, dayMonth, sameDay } from '../data/format';
import { shortId } from '../data/jobs';
import { mapMessage } from '../data/mappers';
import { useJob, useTechData } from '../data/TechData';
import { MESSAGE_MAX, type ChatMessage } from '../data/types';
import { t } from '../i18n';
import { Icon } from '../ui/Icon';
import { BackButton, Loading, OfflineStrip, StatusBadge } from '../ui/kit';
import { useToast } from '../ui/toast';

const QUICK = [t('وصلت للعميل'), t('العميل لا يرد'), t('أحتاج قطعة إضافية')];

export default function ChatPage() {
  const { id } = useParams();
  const job = useJob(id);
  const { jobsReady, chats, company, technician } = useTechData();
  const profile = useProfile();
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLElement>(null);
  const chat = id ? chats[id] : undefined;
  const exists = Boolean(chat);

  useEffect(() => {
    if (!id || !exists) {
      setMessages(exists ? null : []);
      return;
    }
    return onSnapshot(
      query(collection(db, 'jobChats', id, 'messages'), orderBy('createdAt')),
      { includeMetadataChanges: true },
      (snap) => setMessages(snap.docs.map((d) => mapMessage(d.id, d.data(), d.metadata.hasPendingWrites)).filter((m): m is ChatMessage => m !== null)),
      () => setMessages([]),
    );
  }, [id, exists]);

  // Opening the conversation (and each new message from the company while it is open) reads it.
  const lastAt = chat?.lastMessageAt?.getTime() ?? 0;
  const lastFromCompany = chat?.lastMessageSenderRole === 'company';
  useEffect(() => {
    if (id && exists && lastFromCompany) markChatRead(id);
  }, [id, exists, lastAt, lastFromCompany]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages?.length]);

  const send = async (value: string) => {
    if (!job || !value.trim()) return;
    if (value.trim().length > MESSAGE_MAX) {
      toast(t('الرسالة طويلة جدًا.'), 'err');
      return;
    }
    setBusy(true);
    try {
      await sendJobMessage(job, value, technician?.fullName || profile.fullName, exists);
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

  if (!job) {
    return (
      <div className="app">
        <header className="bar">
          <BackButton to="/chats" label={t('رجوع إلى المحادثات')} />
          <div className="bar-title">
            <h1>{t('محادثة الشركة')}</h1>
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
        <BackButton to="/chats" label={t('رجوع إلى المحادثات')} />
        <span style={{ flex: 'none', width: 40, height: 40, borderRadius: 20, background: '#fff', color: '#063b73', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden="true">
          <Icon name="building" />
        </span>
        <div className="bar-title">
          <h1 style={{ fontSize: 16 }}>{companyName}</h1>
          <p style={{ color: '#c3d2e4', opacity: 1 }}>
            {t('محادثة مهمة')} <span className="num">#{shortId(job.id)}</span>
          </p>
        </div>
      </header>
      <OfflineStrip />
      <Link to={`/jobs/${job.id}`} style={{ flex: 'none', color: 'var(--text)', background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="tile" style={{ width: 36, height: 36, borderRadius: 10 }}>
          <Icon name="box" small />
        </span>
        <span className="minw ell" style={{ fontSize: 13, fontWeight: 700 }}>
          {job.productName} · {job.customerName || t('عميل')}
        </span>
        <StatusBadge job={job} short />
      </Link>
      <main ref={listRef} aria-label={t('الرسائل')} aria-live="polite" className="scroll" style={{ padding: '14px 14px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ alignSelf: 'center', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', background: 'var(--surface)', borderRadius: 999, padding: '4px 12px' }}>
          <Icon name="lock" small />
          {t('بينك وبين الشركة فقط، العميل لا يراها')}
        </p>
        {messages === null && <Loading />}
        {messages?.length === 0 && <p className="empty">{t('لا رسائل بعد. اكتب للشركة، أو اختر ردًا سريعًا.')}</p>}
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
      </main>
      <div role="group" aria-label={t('ردود سريعة')} className="chips" style={{ flex: 'none', gap: 8, padding: '8px 14px' }}>
        {QUICK.map((q) => (
          <button key={q} type="button" className="qr" disabled={busy} onClick={() => void send(q)}>
            {q}
          </button>
        ))}
      </div>
      <form onSubmit={submit} style={{ flex: 'none', background: 'var(--surface)', borderTop: '1px solid var(--line)', padding: '10px 12px calc(14px + env(safe-area-inset-bottom))', display: 'flex', alignItems: 'center', gap: 8 }}>
        <label htmlFor="chat-input" className="sr">
          {t('رسالة للشركة')}
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
    </div>
  );
}
