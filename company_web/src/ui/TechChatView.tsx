import { useEffect, useState } from 'react';
import { collection, doc, limitToLast, onSnapshot, orderBy, query, type DocumentData } from 'firebase/firestore';
import { dayTime } from '../data/format';
import type { Order } from '../data/types';
import { db } from '../firebase';
import { t } from '../i18n';
import { Chip, Spinner } from './kit';

interface Line {
  id: string;
  fromTechnician: boolean;
  name: string;
  text: string;
  at: Date | null;
}

const dateOf = (v: unknown): Date | null =>
  v && typeof (v as { toDate?: unknown }).toDate === 'function' ? (v as { toDate: () => Date }).toDate() : null;

const lineOf = (id: string, d: DocumentData): Line => ({
  id,
  fromTechnician: d.senderRole === 'technician',
  name: typeof d.senderName === 'string' ? d.senderName.trim() : '',
  text: typeof d.text === 'string' ? d.text : '',
  at: dateOf(d.createdAt),
});

/**
 * What the order's customer and its technician say to each other
 * (`customerTechChats/{orderId}`). The company reads it to follow the job and
 * settle a complaint, but does not write in it. The messages load only when
 * opened: every message read spends part of the free daily quota.
 */
export function TechChatView({ order }: { order: Order }) {
  const [last, setLast] = useState<{ text: string; at: Date | null; fromTechnician: boolean } | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[] | null>(null);

  useEffect(
    () =>
      onSnapshot(
        doc(db, 'customerTechChats', order.id),
        (snap) => {
          const d = snap.data();
          setLast(d ? { text: typeof d.lastMessageText === 'string' ? d.lastMessageText : '', at: dateOf(d.lastMessageAt), fromTechnician: d.lastMessageSenderRole === 'technician' } : null);
        },
        () => setLast(null),
      ),
    [order.id],
  );

  useEffect(() => {
    if (!open) return;
    setLines(null);
    return onSnapshot(
      query(collection(db, 'customerTechChats', order.id, 'messages'), orderBy('createdAt'), limitToLast(200)),
      (snap) => setLines(snap.docs.map((d) => lineOf(d.id, d.data()))),
      () => setLines([]),
    );
  }, [open, order.id]);

  const technician = order.technicianName || t('الفني');
  const customer = order.customerName || t('العميل');
  return (
    <section className="card" aria-label={t('محادثة العميل والفني')}>
      <div className="card-h">
        <h3>{t('محادثة العميل والفني')}</h3>
        <Chip tone="info">{t('للاطلاع فقط')}</Chip>
      </div>
      <div className="card-b stack t">
        {last === undefined ? (
          <Spinner />
        ) : last === null ? (
          <p className="muted">{t('لم يكتب العميل والفني لبعضهما بعد.')}</p>
        ) : (
          <>
            {!open && (
              <p className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <b>{last.fromTechnician ? technician : customer}:</b> {last.text}
                {last.at && <> · {dayTime(last.at)}</>}
              </p>
            )}
            {open && (
              <div className="msgs" aria-live="polite">
                {lines === null && <Spinner />}
                {lines?.map((m) => (
                  <div key={m.id} className={`msg ${m.fromTechnician ? 'out' : 'in'}`}>
                    <b style={{ display: 'block', fontSize: 12, opacity: 0.8 }}>{m.name || (m.fromTechnician ? technician : customer)}</b>
                    {m.text}
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="btn sm" onClick={() => setOpen(!open)}>
              {open ? t('إخفاء المحادثة') : t('عرض المحادثة')}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
