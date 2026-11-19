import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfirm, useRunner } from '../components/feedback';
import { Badge, Chips, EmptyState, PageHeader, Text } from '../components/ui';
import {
  PLATFORM_NOTICES_SHOWN,
  deletePlatformNotice,
  markPlatformNoticeRead,
  markPlatformNoticesRead,
  platformNoticeTarget,
  usePlatformNotices,
} from '../data/platformNotices';
import type { PlatformNotice, PlatformNoticeType } from '../data/platformNotices';
import { useI18n } from '../i18n/I18nProvider';

type Filter = PlatformNoticeType | 'unread';

/**
 * Every alert sent to the Platform Admins (new reports and 1–2 star ratings),
 * not only the newest few the bell shows: filter, open, mark read, delete, and
 * read further back page by page.
 */
export function NotificationsPage() {
  const { t, dateTime } = useI18n();
  const [max, setMax] = useState(PLATFORM_NOTICES_SHOWN * 2);
  const notices = usePlatformNotices(true, max);
  const [filter, setFilter] = useState<Filter | 'all'>('all');
  const confirm = useConfirm();
  const { busy, run } = useRunner();
  const navigate = useNavigate();

  const list = notices ?? [];
  const unread = list.filter((n) => !n.isRead);
  const visible = useMemo(
    () => list.filter((n) => (filter === 'all' ? true : filter === 'unread' ? !n.isRead : n.type === filter)),
    [list, filter],
  );

  const open = (n: PlatformNotice) => {
    if (!n.isRead) void markPlatformNoticeRead(n.id).catch(() => undefined);
    navigate(platformNoticeTarget(n));
  };
  const remove = async (n: PlatformNotice) => {
    const ok = await confirm({ title: t('alertsPage.delete'), body: t('alertsPage.deleteConfirm'), confirmLabel: t('alertsPage.delete'), danger: true });
    if (ok) await run(n.id, () => deletePlatformNotice(n.id), t('alertsPage.deleted'));
  };

  return (
    <>
      <PageHeader
        title={t('alertsPage.title')}
        subtitle={t('alertsPage.subtitle')}
        back={{ to: '/', label: t('nav.dashboard') }}
        actions={
          <button
            className="btn"
            disabled={unread.length === 0 || busy === 'all'}
            onClick={() => void run('all', () => markPlatformNoticesRead(unread.map((n) => n.id)), t('alerts.markAllRead'))}
          >
            {t('alerts.markAllRead')}
          </button>
        }
      />
      {notices === null ? (
        <div className="card"><p className="muted" style={{ padding: 16 }}>…</p></div>
      ) : list.length === 0 ? (
        <EmptyState message={t('alertsPage.empty')} />
      ) : (
        <>
          <div className="toolbar">
            <Chips
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: t('common.all'), count: list.length },
                { value: 'unread', label: t('alertsPage.unread'), count: unread.length },
                { value: 'new_report', label: t('alertsPage.kind.new_report'), count: list.filter((n) => n.type === 'new_report').length },
                { value: 'low_review', label: t('alertsPage.kind.low_review'), count: list.filter((n) => n.type === 'low_review').length },
              ]}
            />
          </div>
          {visible.length === 0 ? (
            <EmptyState message={t('common.noResults')} />
          ) : (
            <div className="card">
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t('alertsPage.col.alert')}</th>
                      <th>{t('alertsPage.col.kind')}</th>
                      <th>{t('alertsPage.col.at')}</th>
                      <th>{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((n) => (
                      <tr key={n.id} style={n.isRead ? undefined : { fontWeight: 700 }}>
                        <td>
                          <Text>
                            {t(n.type === 'new_report' ? 'alerts.notice.new_report' : 'alerts.notice.low_review', { name: n.name || '—' })}
                          </Text>
                          {!n.isRead && <> <Badge tone="info">{t('alertsPage.new')}</Badge></>}
                        </td>
                        <td>
                          <Badge tone={n.type === 'new_report' ? 'danger' : 'warning'}>{t(`alertsPage.kind.${n.type}`)}</Badge>
                        </td>
                        <td>{n.createdAt ? dateTime(n.createdAt) : '—'}</td>
                        <td>
                          <div className="btn-group">
                            <button className="btn btn--sm" onClick={() => open(n)}>{t('alertsPage.open')}</button>
                            {!n.isRead && (
                              <button className="btn btn--sm" onClick={() => void markPlatformNoticeRead(n.id).catch(() => undefined)}>
                                {t('alertsPage.markRead')}
                              </button>
                            )}
                            <button className="btn btn--danger btn--sm" disabled={busy === n.id} onClick={() => void remove(n)}>
                              {t('alertsPage.delete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {list.length >= max && (
            <button className="btn" style={{ alignSelf: 'center', marginTop: 12 }} onClick={() => setMax((m) => m + PLATFORM_NOTICES_SHOWN * 2)}>
              {t('alertsPage.more')}
            </button>
          )}
        </>
      )}
    </>
  );
}
