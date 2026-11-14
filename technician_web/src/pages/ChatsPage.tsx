import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { shortWhen } from '../data/format';
import { chatUnread, isOpenJob, shortId } from '../data/jobs';
import { searchRanked } from '../data/searchRanking';
import { useTechData } from '../data/TechData';
import type { Job, JobChat } from '../data/types';
import { t } from '../i18n';
import { Icon } from '../ui/Icon';
import { BellButton, OfflineStrip, SkeletonCards, StatusBadge } from '../ui/kit';

interface Row {
  job: Job;
  chat: JobChat | null;
}

export default function ChatsPage() {
  const { jobs, jobsReady, chats } = useTechData();
  const [q, setQ] = useState('');

  const rows = useMemo<Row[]>(() => {
    const withChat: Row[] = [];
    const quiet: Row[] = [];
    for (const job of jobs) {
      const chat = chats[job.id] ?? null;
      if (chat?.lastMessageAt) withChat.push({ job, chat });
      else if (isOpenJob(job)) quiet.push({ job, chat: null });
    }
    withChat.sort((a, b) => b.chat!.lastMessageAt!.getTime() - a.chat!.lastMessageAt!.getTime());
    return [...withChat, ...quiet];
  }, [jobs, chats]);

  const shown = useMemo(
    () =>
      q.trim()
        ? searchRanked(rows, q, (r) => [
            { text: r.job.productName, weight: 3 },
            { text: r.job.customerName, weight: 2 },
            { text: shortId(r.job.id), weight: 3 },
            { text: r.chat?.lastMessageText ?? '', weight: 1 },
          ])
        : rows,
    [rows, q],
  );

  return (
    <>
      <header className="bar">
        <div className="bar-title" style={{ paddingInlineStart: 4 }}>
          <h1 style={{ fontSize: 19 }}>{t('المحادثات')}</h1>
          <p>{t('محادثة لكل مهمة، بينك وبين الشركة')}</p>
        </div>
        <BellButton />
      </header>
      <OfflineStrip />
      <div style={{ flex: 'none', padding: '12px 16px 4px' }}>
        <label className="search">
          <Icon name="search" />
          <span className="sr">{t('بحث في المحادثات')}</span>
          <input type="search" placeholder={t('ابحث بالمنتج أو العميل أو رقم المهمة')} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <main className="scroll" style={{ padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!jobsReady ? (
          <SkeletonCards count={4} height={92} />
        ) : shown.length === 0 ? (
          <div className="card empty">{q.trim() ? t('لا توجد محادثة تطابق «{0}».', q.trim()) : t('لا محادثات بعد. افتح أي مهمة واضغط «محادثة» لتكتب للشركة.')}</div>
        ) : (
          shown.map(({ job, chat }) => {
            const unread = chatUnread(chat);
            const last = chat?.lastMessageText
              ? `${chat.lastMessageSenderRole === 'technician' ? t('أنت:') : t('الشركة:')} ${chat.lastMessageText}`
              : t('لا رسائل بعد');
            return (
              <Link
                key={job.id}
                to={`/chats/${job.id}`}
                className="card"
                style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, background: unread ? 'var(--unread)' : undefined }}
                aria-label={unread ? `${job.productName}، ${t('رسالة جديدة')}` : undefined}
              >
                <span style={{ flex: 'none', width: 48, height: 48, borderRadius: 24, background: '#063b73', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="building" />
                </span>
                <span className="minw" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="row" style={{ gap: 6 }}>
                    <span className="ell" style={{ fontSize: 15, fontWeight: 800 }}>
                      {job.productName} · {job.customerName || t('عميل')}
                    </span>
                    {chat?.lastMessageAt && (
                      <span style={{ marginInlineStart: 'auto', flex: 'none', fontSize: 12, color: unread ? 'var(--action)' : 'var(--muted)', fontWeight: unread ? 700 : 400 }}>
                        {shortWhen(chat.lastMessageAt)}
                      </span>
                    )}
                  </span>
                  <span className="row" style={{ gap: 6 }}>
                    <span className="minw ell" style={{ fontSize: 14, color: unread ? 'var(--text)' : 'var(--muted)', fontWeight: unread ? 700 : 400 }}>
                      {last}
                    </span>
                    {unread && <span style={{ flex: 'none', width: 12, height: 12, borderRadius: 6, background: 'var(--action)' }} aria-hidden="true" />}
                  </span>
                  <span className="row" style={{ gap: 6, marginTop: 2 }}>
                    <span className="num" style={{ fontSize: 12, color: 'var(--muted)' }}>
                      #{shortId(job.id)}
                    </span>
                    <StatusBadge job={job} short />
                  </span>
                </span>
              </Link>
            );
          })
        )}
      </main>
    </>
  );
}
