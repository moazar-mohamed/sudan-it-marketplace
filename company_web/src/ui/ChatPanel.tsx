import { useEffect, useMemo, useRef, useState } from 'react';
import { markChatRead } from '../data/inbox';
import { sendChatMessage, useOrderChat } from '../data/chat';
import { JumpToLatest, useChatScroll } from './JumpToLatest';
import { useToast } from './toast';
import { t } from '../i18n';

/** A conversation with the customer: its messages, live, and a box to answer. Opening it marks it read. */
export function ChatPanel({ chatId, senderName, title = t('محادثة الطلب') }: { chatId: string; senderName: string; title?: string }) {
  const { exists, messages } = useOrderChat(chatId);
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const items = useMemo(() => messages.map((m) => ({ id: m.id, mine: m.senderRole === 'company' })), [messages]);
  const scroll = useChatScroll(box, items);
  // Having it open is reading it: a message that arrives meanwhile is read too.
  useEffect(() => { if (exists) void markChatRead(chatId); }, [chatId, exists, messages.length]);

  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    const ok = await sendChatMessage(chatId, text, senderName);
    if (ok) setText(''); else toast(t('تعذّر إرسال الرسالة.'), 'err');
    setBusy(false);
  };
  return (
    <section className="card" aria-label={t('المحادثة')}>
      <div className="card-h"><h3>{title}</h3></div>
      <div className="card-b stack t">
        {exists === false ? <p className="muted">{t('لا توجد محادثة لهذا الطلب (طلب قديم سبق المحادثات).')}</p> : (
          <>
            <div className="msgs" ref={box} onScroll={scroll.onScroll} aria-live="polite">
              {messages.length === 0 && <p className="muted">{t('لا رسائل بعد.')}</p>}
              {messages.map((m) => <div key={m.id} className={`msg ${m.senderRole === 'company' ? 'out' : 'in'}`}>{m.text}</div>)}
              <JumpToLatest show={scroll.show} unseen={scroll.unseen} onJump={scroll.jump} />
            </div>
            <div className="row">
              <input className="inp" value={text} placeholder={t('اكتب رسالة للعميل…')} aria-label={t('رسالة')} maxLength={2000} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void send()} />
              <button type="button" className="btn p" disabled={busy || !text.trim()} onClick={() => void send()}>{t('إرسال')}</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
