import { useEffect, useRef, useState } from 'react';
import { jobChatUnread, markJobChatRead, sendJobChatMessage, useJobChatHead, useJobChatLines } from '../data/jobChat';
import { dayTime } from '../data/format';
import type { Order } from '../data/types';
import { t } from '../i18n';
import { Chip, Spinner } from './kit';
import { useToast } from './toast';

/**
 * The company's conversation with the technician it sent for this order (the
 * same one as in the app and the technician portal). The messages load only
 * when it is opened; opening it marks it read. [startOpen] opens it at once,
 * for a link from a push or a notification.
 */
export function JobChatPanel({ order, senderName, startOpen = false }: { order: Order; senderName: string; startOpen?: boolean }) {
  const head = useJobChatHead(order.id);
  const [open, setOpen] = useState(startOpen);
  const lines = useJobChatLines(order.id, open);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const box = useRef<HTMLDivElement>(null);
  const closed = order.orderStatus === 'completed' || order.orderStatus === 'cancelled';

  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [lines?.length]);
  // Having it open is reading it: a message that arrives meanwhile is read too.
  useEffect(() => { if (open && head && jobChatUnread(head)) markJobChatRead(order.id); }, [open, head, order.id]);

  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    const ok = await sendJobChatMessage(order, text, senderName, !!head);
    if (ok) {
      setText('');
      setOpen(true);
    } else toast(t('تعذّر إرسال الرسالة.'), 'err');
    setBusy(false);
  };

  const technician = order.technicianName || t('الفني');
  return (
    <section className="card" id="technician-chat" aria-label={t('محادثة الفني')}>
      <div className="card-h">
        <h3>{t('محادثة الفني')}</h3>
        {jobChatUnread(head ?? null) && <Chip tone="info">{t('رسالة جديدة')}</Chip>}
      </div>
      <div className="card-b stack t">
        {head === undefined ? (
          <Spinner />
        ) : (
          <>
            {!open && (
              <p className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {head ? (
                  <>
                    <b>{head.lastFromTechnician ? technician : t('الشركة')}:</b> {head.lastMessageText}
                    {head.lastMessageAt && <> · {dayTime(head.lastMessageAt)}</>}
                  </>
                ) : (
                  t('لا رسائل بعد مع {0}. اكتب له هنا عن موعد التركيب أو أي تفاصيل.', technician)
                )}
              </p>
            )}
            {open && (
              <div className="msgs" ref={box} aria-live="polite">
                {lines === null && <Spinner />}
                {lines?.length === 0 && <p className="muted">{t('لا رسائل بعد.')}</p>}
                {lines?.map((m) => (
                  <div key={m.id} className={`msg ${m.fromCompany ? 'out' : 'in'}`}>
                    {!m.fromCompany && <b style={{ display: 'block', fontSize: 12, opacity: 0.8 }}>{m.name || technician}</b>}
                    {m.text}
                  </div>
                ))}
              </div>
            )}
            {head && (
              <button type="button" className="btn sm" onClick={() => setOpen(!open)}>
                {open ? t('إخفاء المحادثة') : t('عرض المحادثة')}
              </button>
            )}
            {!closed && (
              <div className="row">
                <input
                  className="inp"
                  value={text}
                  placeholder={t('اكتب رسالة للفني…')}
                  aria-label={t('رسالة للفني')}
                  maxLength={2000}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void send()}
                />
                <button type="button" className="btn p" disabled={busy || !text.trim()} onClick={() => void send()}>{t('إرسال')}</button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
