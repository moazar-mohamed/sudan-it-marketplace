import { useEffect, useRef, useState } from 'react';
import { markChatRead } from '../data/inbox';
import { sendChatMessage, useOrderChat } from '../data/chat';
import { useToast } from './toast';

/** A conversation with the customer: its messages, live, and a box to answer. Opening it marks it read. */
export function ChatPanel({ chatId, senderName, title = 'محادثة الطلب' }: { chatId: string; senderName: string; title?: string }) {
  const { exists, messages } = useOrderChat(chatId);
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [messages.length]);
  // Having it open is reading it: a message that arrives meanwhile is read too.
  useEffect(() => { if (exists) void markChatRead(chatId); }, [chatId, exists, messages.length]);

  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    const ok = await sendChatMessage(chatId, text, senderName);
    if (ok) setText(''); else toast('تعذّر إرسال الرسالة.', 'err');
    setBusy(false);
  };
  return (
    <section className="card" aria-label="المحادثة">
      <div className="card-h"><h3>{title}</h3></div>
      <div className="card-b stack t">
        {exists === false ? <p className="muted">لا توجد محادثة لهذا الطلب (طلب قديم سبق المحادثات).</p> : (
          <>
            <div className="msgs" ref={box} aria-live="polite">
              {messages.length === 0 && <p className="muted">لا رسائل بعد.</p>}
              {messages.map((m) => <div key={m.id} className={`msg ${m.senderRole === 'company' ? 'out' : 'in'}`}>{m.text}</div>)}
            </div>
            <div className="row">
              <input className="inp" value={text} placeholder="اكتب رسالة للعميل…" aria-label="رسالة" maxLength={2000} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void send()} />
              <button type="button" className="btn p" disabled={busy || !text.trim()} onClick={() => void send()}>إرسال</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
