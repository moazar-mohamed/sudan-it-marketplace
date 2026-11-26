import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRunner } from '../components/feedback';
import { ReasonDialog } from '../components/ReasonDialog';
import { SortTh, useSortedRows } from '../components/sort';
import { Badge, Chips, DataGate, EmptyState, PageHeader, SearchInput, Text, type Tone } from '../components/ui';
import { SidePanel, SplitView } from '../components/v2';
import { cityNames } from '../data/cities';
import {
  APPLICATION_STATUSES,
  decideApplication,
  type ApplicationStatus,
  type CompanyApplication,
} from '../data/companyApplications';
import { useCompanyApplications } from '../data/hooks';
import { useI18n } from '../i18n/I18nProvider';
import { matchesQuery } from '../utils';

const STATUS_TONE: Record<ApplicationStatus, Tone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
};

/** Where approving starts: the applicant's customer page opens its "Convert to company" form, filled in. */
export const approvePath = (application: CompanyApplication) => `/customers/${application.id}?apply=1`;

function ApplicationPanel({ application, onClose }: { application: CompanyApplication; onClose: () => void }) {
  const { t, dateTime, locale } = useI18n();
  const navigate = useNavigate();
  const { run } = useRunner();
  const [rejecting, setRejecting] = useState(false);
  const pending = application.status === 'pending';

  return (
    <SidePanel
      title={application.companyName || t('applications.detailsTitle')}
      subtitle={t('applications.detailsTitle')}
      status={<Badge tone={STATUS_TONE[application.status]}>{t(`applications.status.${application.status}`)}</Badge>}
      closeLabel={t('common.close')}
      onClose={onClose}
    >
      <dl className="report__meta">
        <div>
          <dt>{t('applications.col.contact')}</dt>
          <dd>
            <Text>{application.contactName || '—'}</Text>
            {application.applicantEmail && (
              <>
                {' · '}
                <bdi dir="ltr">{application.applicantEmail}</bdi>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt>{t('applications.phone')}</dt>
          <dd>
            <bdi dir="ltr">{application.phone || '—'}</bdi>
          </dd>
        </div>
        <div>
          <dt>{t('applications.col.city')}</dt>
          <dd>{cityNames([application.cityId], locale) || application.cityId || '—'}</dd>
        </div>
        <div>
          <dt>{t('applications.registration')}</dt>
          <dd>
            <bdi dir="ltr">{application.registrationNumber || '—'}</bdi>
          </dd>
        </div>
        <div>
          <dt>{t('applications.col.received')}</dt>
          <dd>{dateTime(application.createdAt)}</dd>
        </div>
      </dl>
      {application.about && (
        <>
          <h4 className="report__label">{t('applications.about')}</h4>
          <p className="report__details" dir="auto">
            {application.about}
          </p>
        </>
      )}
      {application.status === 'rejected' && (
        <>
          <h4 className="report__label">{t('applications.reason')}</h4>
          <p className="report__details" dir="auto">
            {application.decisionNote}
          </p>
        </>
      )}
      {application.decidedAt && (
        <p className="muted">
          {t('applications.decided')}: {dateTime(application.decidedAt)}
        </p>
      )}
      {pending ? (
        <>
          <p className="note">{t('applications.approveHint')}</p>
          <div className="modal__actions">
            <button type="button" className="btn btn--danger" onClick={() => setRejecting(true)}>
              {t('applications.reject')}
            </button>
            <button type="button" className="btn btn--primary" onClick={() => navigate(approvePath(application))}>
              {t('applications.approve')}
            </button>
          </div>
        </>
      ) : (
        <div className="modal__actions">
          <button type="button" className="btn" onClick={() => navigate(`/customers/${application.id}`)}>
            {t('applications.openAccount')}
          </button>
        </div>
      )}
      {rejecting && (
        <ReasonDialog
          title={t('applications.rejectTitle')}
          body={t('applications.rejectBody', { name: application.companyName })}
          label={t('applications.reason')}
          confirmLabel={t('applications.reject')}
          danger
          onSubmit={(reason) =>
            run('reject', () => decideApplication(application, 'rejected', reason), t('applications.rejected'))
          }
          onClose={() => setRejecting(false)}
        />
      )}
    </SidePanel>
  );
}

const SORTS = {
  received: (a: CompanyApplication) => a.createdAt,
  company: (a: CompanyApplication) => a.companyName,
  status: (a: CompanyApplication) => APPLICATION_STATUSES.indexOf(a.status),
};

/** Companies asking to join, sent from the customer site (company_applications). */
export function CompanyApplicationsPage() {
  const { t, dateTime, locale } = useI18n();
  const applications = useCompanyApplications();
  const [filter, setFilter] = useState<ApplicationStatus | 'all'>('pending');
  const [query, setQuery] = useState('');
  // Kept by id, so the panel follows the stored copy while it is open.
  const [openId, setOpenId] = useState<string | null>(null);

  const visible = applications.data.filter(
    (a) =>
      (filter === 'all' || a.status === filter) &&
      matchesQuery(query, a.companyName, a.contactName, a.applicantEmail, a.phone, a.registrationNumber),
  );
  const { rows, sort, toggle } = useSortedRows(visible, SORTS);
  const opened = applications.data.find((a) => a.id === openId) ?? null;
  const count = (s: ApplicationStatus) => applications.data.filter((a) => a.status === s).length;
  const panel = opened ? (
    <ApplicationPanel key={`${opened.id}-${opened.status}`} application={opened} onClose={() => setOpenId(null)} />
  ) : null;

  return (
    <>
      <PageHeader title={t('applications.title')} subtitle={t('applications.subtitle')} back={{ to: '/', label: t('nav.dashboard') }} />
      <DataGate gates={[applications]}>
        {applications.data.length === 0 ? (
          <EmptyState message={t('applications.empty')} hint={t('applications.emptyHint')} />
        ) : (
          <>
            <div className="toolbar">
              <Chips
                value={filter}
                onChange={setFilter}
                options={[
                  ...APPLICATION_STATUSES.map((s) => ({ value: s, label: t(`applications.status.${s}`), count: count(s) })),
                  { value: 'all' as const, label: t('common.all'), count: applications.data.length },
                ]}
              />
              <div className="toolbar__end">
                <SearchInput value={query} onChange={setQuery} placeholder={t('applications.search')} />
              </div>
            </div>
            <SplitView panel={panel}>
              {rows.length === 0 ? (
                <EmptyState message={t('common.noResults')} />
              ) : (
                <div className="card">
                  <div className="table-wrap">
                    <table className="data">
                      <thead>
                        <tr>
                          <SortTh label={t('applications.col.received')} sortKey="received" sort={sort} onSort={toggle} />
                          <SortTh label={t('applications.col.company')} sortKey="company" sort={sort} onSort={toggle} />
                          <th>{t('applications.col.contact')}</th>
                          <th>{t('applications.col.city')}</th>
                          <SortTh label={t('col.status')} sortKey="status" sort={sort} onSort={toggle} />
                          <th>{t('common.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((a) => (
                          <tr key={a.id}>
                            <td className="nowrap">{dateTime(a.createdAt)}</td>
                            <td className="cell-wrap">
                              <button type="button" className="link-btn" onClick={() => setOpenId(a.id)}>
                                <Text>{a.companyName}</Text>
                              </button>
                            </td>
                            <td>
                              <Text>{a.contactName || '—'}</Text>
                              <div className="muted">
                                <bdi dir="ltr">{a.phone}</bdi>
                              </div>
                            </td>
                            <td>{cityNames([a.cityId], locale) || a.cityId}</td>
                            <td>
                              <Badge tone={STATUS_TONE[a.status]}>{t(`applications.status.${a.status}`)}</Badge>
                            </td>
                            <td>
                              <button type="button" className="btn btn--sm" onClick={() => setOpenId(a.id)}>
                                {t('applications.open')}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </SplitView>
          </>
        )}
      </DataGate>
    </>
  );
}
