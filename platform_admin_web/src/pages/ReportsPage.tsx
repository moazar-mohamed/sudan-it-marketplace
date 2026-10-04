import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRunner } from '../components/feedback';
import { SortTh, useSortedRows } from '../components/sort';
import { Badge, Chips, DataGate, EmptyState, Modal, PageHeader, SearchInput, Text, type Tone } from '../components/ui';
import { setReportStatus } from '../data/actions';
import { useReports } from '../data/hooks';
import { REPORT_STATUSES, type Report, type ReportStatus } from '../data/types';
import { useI18n } from '../i18n/I18nProvider';
import { en, type TranslationKey } from '../i18n/dictionary';
import { matchesQuery } from '../utils';

const STATUS_TONE: Record<ReportStatus, Tone> = {
  new: 'warning',
  in_progress: 'progress',
  closed: 'success',
};

const known = (key: string): key is TranslationKey => key in en;

/** The text of a label in the dictionary, or the stored value when it is one this version does not know. */
function useLabel() {
  const { t } = useI18n();
  return (prefix: string, value: string) => {
    const key = `${prefix}.${value}`;
    return known(key) ? t(key) : value;
  };
}

function ReportDialog({ report, onClose }: { report: Report; onClose: () => void }) {
  const { t, dateTime } = useI18n();
  const label = useLabel();
  const { busy, run } = useRunner();
  const replyId = useId();
  const [status, setStatus] = useState<ReportStatus>(report.status);
  const [resolution, setResolution] = useState(report.resolution);
  const unchanged = status === report.status && resolution.trim() === report.resolution;

  const save = async () => {
    const ok = await run('save', () => setReportStatus(report, status, resolution), t('reports.saved'));
    if (ok) onClose();
  };

  return (
    <Modal title={t('reports.detailsTitle')} onClose={onClose} wide>
      <h3 className="report__subject">
        <Text>{report.subject}</Text>
      </h3>
      <dl className="report__meta">
        <div>
          <dt>{t('reports.sentBy')}</dt>
          <dd>
            <Text>{report.reporterName || '—'}</Text> · {label('reports.role', report.reporterRole)}
            {report.reporterEmail && (
              <>
                {' · '}
                <bdi dir="ltr">{report.reporterEmail}</bdi>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt>{t('reports.col.reason')}</dt>
          <dd>{label('reports.reason', report.reason)}</dd>
        </div>
        <div>
          <dt>{t('reports.col.received')}</dt>
          <dd>{dateTime(report.createdAt)}</dd>
        </div>
        {report.orderRef && (
          <div>
            <dt>{t('reports.order')}</dt>
            <dd>
              <bdi dir="ltr">{report.orderRef}</bdi> <span className="muted">· {t('reports.orderHint')}</span>
            </dd>
          </div>
        )}
        {report.companyId && (
          <div>
            <dt>{t('reports.company')}</dt>
            <dd>
              <Link to={`/companies/${report.companyId}`}>{t('reports.openCompany')}</Link>
            </dd>
          </div>
        )}
      </dl>
      <h4 className="report__label">{t('reports.details')}</h4>
      <p className="report__details" dir="auto">
        {report.details}
      </p>

      <div className="report__label">{t('reports.statusLabel')}</div>
      <div className="segmented" role="group" aria-label={t('reports.statusLabel')}>
        {REPORT_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            className={status === s ? 'segmented__item segmented__item--active' : 'segmented__item'}
            onClick={() => setStatus(s)}
          >
            {t(`reports.status.${s}`)}
          </button>
        ))}
      </div>

      <div className="field report__reply">
        <label htmlFor={replyId}>{t('reports.resolution')}</label>
        <textarea
          id={replyId}
          rows={3}
          value={resolution}
          maxLength={500}
          dir="auto"
          onChange={(e) => setResolution(e.target.value)}
        />
        <small className="muted">{t('reports.resolutionHint')}</small>
      </div>
      {report.updatedAt && report.updatedAt.getTime() !== report.createdAt?.getTime() && (
        <p className="muted">
          {t('reports.updated')}: {dateTime(report.updatedAt)}
        </p>
      )}
      <div className="modal__actions">
        <button type="button" className="btn" onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button type="button" className="btn btn--primary" disabled={unchanged || busy === 'save'} onClick={() => void save()}>
          {busy === 'save' ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </Modal>
  );
}

const SORTS = {
  received: (r: Report) => r.createdAt,
  from: (r: Report) => r.reporterName,
  subject: (r: Report) => r.subject,
  status: (r: Report) => REPORT_STATUSES.indexOf(r.status),
};

/** What customers and companies sent to the platform team, and where each one stands. */
export function ReportsPage() {
  const { t, dateTime } = useI18n();
  const label = useLabel();
  const reports = useReports();
  const [filter, setFilter] = useState<ReportStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  // Kept by id, so the dialog follows the stored copy while it is open.
  const [openId, setOpenId] = useState<string | null>(null);

  const visible = reports.data.filter(
    (r) =>
      (filter === 'all' || r.status === filter) &&
      matchesQuery(query, r.subject, r.details, r.reporterName, r.reporterEmail, r.orderRef),
  );
  const { rows, sort, toggle } = useSortedRows(visible, SORTS);
  const opened = reports.data.find((r) => r.id === openId) ?? null;
  const count = (s: ReportStatus) => reports.data.filter((r) => r.status === s).length;

  return (
    <>
      <PageHeader
        title={t('reports.title')}
        subtitle={t('reports.subtitle')}
        back={{ to: '/', label: t('nav.dashboard') }}
      />
      <DataGate gates={[reports]}>
        {reports.data.length === 0 ? (
          <EmptyState message={t('reports.empty')} hint={t('reports.emptyHint')} />
        ) : (
          <>
            <div className="toolbar">
              <Chips
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: t('common.all'), count: reports.data.length },
                  ...REPORT_STATUSES.map((s) => ({ value: s, label: t(`reports.status.${s}`), count: count(s) })),
                ]}
              />
              <div className="toolbar__end">
                <SearchInput value={query} onChange={setQuery} placeholder={t('reports.search')} />
              </div>
            </div>
            {rows.length === 0 ? (
              <EmptyState message={t('common.noResults')} />
            ) : (
              <div className="card">
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <SortTh label={t('reports.col.received')} sortKey="received" sort={sort} onSort={toggle} />
                        <SortTh label={t('reports.col.from')} sortKey="from" sort={sort} onSort={toggle} />
                        <th>{t('reports.col.reason')}</th>
                        <SortTh label={t('reports.col.subject')} sortKey="subject" sort={sort} onSort={toggle} />
                        <SortTh label={t('col.status')} sortKey="status" sort={sort} onSort={toggle} />
                        <th>{t('common.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id}>
                          <td className="nowrap">{dateTime(r.createdAt)}</td>
                          <td>
                            <Text>{r.reporterName || '—'}</Text>
                            <div className="muted">{label('reports.role', r.reporterRole)}</div>
                          </td>
                          <td>{label('reports.reason', r.reason)}</td>
                          <td className="cell-wrap">
                            <button type="button" className="link-btn report__open" onClick={() => setOpenId(r.id)}>
                              <Text>{r.subject}</Text>
                            </button>
                          </td>
                          <td>
                            <Badge tone={STATUS_TONE[r.status]}>{t(`reports.status.${r.status}`)}</Badge>
                          </td>
                          <td>
                            <button type="button" className="btn btn--sm" onClick={() => setOpenId(r.id)}>
                              {t('reports.open')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </DataGate>
      {opened && <ReportDialog key={`${opened.id}-${opened.status}-${opened.resolution}`} report={opened} onClose={() => setOpenId(null)} />}
    </>
  );
}
