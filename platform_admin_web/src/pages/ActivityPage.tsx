import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AttentionBanner } from '../components/AttentionBanner';
import { Chips, DataGate, EmptyState, PageHeader, SearchInput, Text } from '../components/ui';
import { useAuditLog } from '../data/hooks';
import { AUDIT_LOG_LIMIT } from '../data/store';
import { AUDIT_TARGET_TYPES, type AuditEntry, type AuditTargetType } from '../data/types';
import { useI18n } from '../i18n/I18nProvider';
import { en, type TranslationKey } from '../i18n/dictionary';
import { matchesQuery } from '../utils';

/** Where an entry's record can still be opened; a deleted record has no page. */
function recordLink(entry: AuditEntry): string | null {
  if (entry.action === 'company.delete') return null;
  if (entry.targetType === 'company') return `/companies/${entry.targetId}`;
  if (entry.targetType === 'customer') return `/customers/${entry.targetId}`;
  if (entry.targetType === 'product') return `/products/${entry.targetId}`;
  if (entry.targetType === 'order') return `/orders/${entry.targetId}`;
  if (entry.targetType === 'admin') return '/admins';
  if (entry.targetType === 'report') return '/reports';
  return null;
}

/** Every change Platform Admin made from this dashboard, newest first. Read-only. */
export function ActivityPage() {
  const { t, dateTime } = useI18n();
  const log = useAuditLog();
  // ?target=<record id> narrows the trail to one company / customer / review ...
  const [params, setParams] = useSearchParams();
  const target = params.get('target') ?? '';
  const [type, setType] = useState<AuditTargetType | 'all'>('all');
  const [query, setQuery] = useState('');

  const known = (key: string): key is TranslationKey => key in en;
  const actionLabel = (entry: AuditEntry) => {
    const key = `activity.action.${entry.action}`;
    return known(key) ? t(key) : entry.action;
  };
  const detailLabel = (entry: AuditEntry) => {
    if (entry.action === 'company.status') {
      const key = `company.status.${entry.detail}`;
      return known(key) ? t(key) : entry.detail;
    }
    if (entry.action === 'customer.active') {
      return entry.detail === 'active' || entry.detail === 'inactive' ? t(`user.${entry.detail}`) : entry.detail;
    }
    if (entry.action === 'category.active' || entry.action === 'service.active') {
      return entry.detail === 'active' || entry.detail === 'inactive'
        ? t(`category.${entry.detail}`)
        : entry.detail;
    }
    if (entry.action === 'report.status') {
      const key = `reports.status.${entry.detail}`;
      return known(key) ? t(key) : entry.detail;
    }
    if (entry.action.startsWith('settings.')) {
      return entry.detail === 'on' || entry.detail === 'off' ? t(`activity.detail.${entry.detail}`) : entry.detail;
    }
    if (entry.action === 'category.move') {
      return entry.detail ? t('activity.moveTo', { parent: entry.detail }) : t('activity.moveToTop');
    }
    return entry.detail;
  };

  const onRecord = useMemo(
    () => (target ? log.data.filter((e) => e.targetId === target) : log.data),
    [log.data, target],
  );
  const inType = useMemo(
    () => onRecord.filter((e) => type === 'all' || e.targetType === type),
    [onRecord, type],
  );
  const visible = inType.filter((e) =>
    matchesQuery(query, e.actorName, e.targetName, e.targetId, actionLabel(e), e.detail),
  );

  return (
    <>
      <PageHeader
        title={t('activity.title')}
        subtitle={t('activity.subtitle')}
        back={{ to: '/', label: t('nav.dashboard') }}
      />
      <DataGate gates={[log]}>
        {log.data.length === 0 ? (
          <EmptyState message={t('activity.empty')} hint={t('activity.emptyHint')} />
        ) : (
          <>
            {target && (
              <AttentionBanner
                label={t('activity.showingRecord')}
                onClear={() => setParams({}, { replace: true })}
              />
            )}
            <div className="toolbar">
              <Chips
                value={type}
                onChange={setType}
                options={[
                  { value: 'all', label: t('common.all'), count: onRecord.length },
                  ...AUDIT_TARGET_TYPES.map((value) => ({
                    value,
                    label: t(`activity.type.${value}`),
                    count: onRecord.filter((e) => e.targetType === value).length,
                  })),
                ]}
              />
              <div className="toolbar__end">
                <SearchInput value={query} onChange={setQuery} placeholder={t('activity.search')} />
              </div>
            </div>

            {visible.length === 0 ? (
              <EmptyState message={t('common.noResults')} />
            ) : (
              <div className="card">
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>{t('activity.col.when')}</th>
                        <th>{t('activity.col.admin')}</th>
                        <th>{t('activity.col.action')}</th>
                        <th>{t('activity.col.record')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((e) => {
                        const link = recordLink(e);
                        const name = e.targetName || e.targetId;
                        const detail = detailLabel(e);
                        return (
                          <tr key={e.id}>
                            <td className="nowrap">{dateTime(e.createdAt)}</td>
                            <td>
                              <Text>{e.actorName || e.actorId}</Text>
                            </td>
                            <td>
                              {actionLabel(e)}
                              {detail && (
                                <div className="muted">
                                  <Text>{detail}</Text>
                                </div>
                              )}
                            </td>
                            <td>
                              <span className="muted">
                                {known(`activity.type.${e.targetType}`)
                                  ? t(`activity.type.${e.targetType}` as TranslationKey)
                                  : e.targetType}
                                {' · '}
                              </span>
                              {link ? (
                                <Link to={link}>
                                  <Text>{name}</Text>
                                </Link>
                              ) : (
                                <Text>{name}</Text>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {log.data.length >= AUDIT_LOG_LIMIT && (
              <p className="muted">{t('activity.limitNote', { count: AUDIT_LOG_LIMIT })}</p>
            )}
          </>
        )}
      </DataGate>
    </>
  );
}
