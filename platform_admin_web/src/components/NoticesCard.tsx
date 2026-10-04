import { useState } from 'react';
import { savePlatformSettings } from '../data/actions';
import {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_KINDS,
  fromLocalInput,
  MAX_BUILD,
  MAX_LABEL_LENGTH,
  MAX_NOTICE_LENGTH,
  noticeProblem,
  noticeStatus,
  sameNotice,
  sameUpdate,
  toLocalInput,
  updateProblem,
  type Announcement,
  type AnnouncementAudience,
  type AnnouncementKind,
  type Notice,
  type NoticeLink,
  type PlatformSettings,
  type RequiredUpdate,
} from '../data/platformSettings';
import { usePlatformSettings } from '../data/usePlatformSettings';
import { useNow } from '../data/useNow';
import { useI18n } from '../i18n/I18nProvider';
import { useRunner } from './feedback';
import { AnnouncementPreview, MaintenancePreview, UpdatePreview } from './NoticePreviews';
import { Disclosure, ErrorState, LoadingState } from './ui';

type Kind = 'maintenance' | 'announcement';

/** Where a notice stands right now: off, waiting for its start, showing, or past its end. */
function StatusLine({ notice }: { notice: Notice }) {
  const { t, dateTime } = useI18n();
  const now = useNow();
  const status = noticeStatus(notice, now);
  const when = status === 'waiting' ? notice.startsAt : status === 'ended' ? notice.endsAt : null;
  return (
    <p className={`notice-status notice-status--${status}`} role="status">
      {t(`notices.status.${status}`, { time: when ? dateTime(when) : '' })}
    </p>
  );
}

function ScheduleFields({ notice, onChange }: { notice: Notice; onChange: (next: Notice) => void }) {
  const { t } = useI18n();
  return (
    <fieldset className="fieldset">
      <legend>{t('notices.schedule')}</legend>
      <p className="muted">{t('notices.scheduleHint')}</p>
      <div className="field-row">
        <label className="field">
          <span>{t('notices.startsAt')}</span>
          <input
            type="datetime-local"
            value={toLocalInput(notice.startsAt)}
            onChange={(e) => onChange({ ...notice, startsAt: fromLocalInput(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>{t('notices.endsAt')}</span>
          <input
            type="datetime-local"
            value={toLocalInput(notice.endsAt)}
            onChange={(e) => onChange({ ...notice, endsAt: fromLocalInput(e.target.value) })}
          />
        </label>
      </div>
    </fieldset>
  );
}

function LinkFields({ title, link, onChange }: { title: string; link: NoticeLink; onChange: (next: NoticeLink) => void }) {
  const { t } = useI18n();
  return (
    <fieldset className="fieldset">
      <legend>{title}</legend>
      <label className="field">
        <span>{t('notices.linkUrl')}</span>
        <input
          type="url"
          dir="ltr"
          placeholder="https://"
          value={link.url}
          maxLength={300}
          onChange={(e) => onChange({ ...link, url: e.target.value })}
        />
      </label>
      <div className="field-row">
        <label className="field">
          <span>{t('notices.linkLabelAr')}</span>
          <input dir="rtl" value={link.labelAr} maxLength={MAX_LABEL_LENGTH} onChange={(e) => onChange({ ...link, labelAr: e.target.value })} />
        </label>
        <label className="field">
          <span>{t('notices.linkLabelEn')}</span>
          <input dir="ltr" value={link.labelEn} maxLength={MAX_LABEL_LENGTH} onChange={(e) => onChange({ ...link, labelEn: e.target.value })} />
        </label>
      </div>
    </fieldset>
  );
}

/**
 * One notice: a switch, the Arabic and English texts, an optional schedule
 * and button and (for the announcement) its kind and who sees it, with a
 * preview of how it will look. Saving writes the whole notices document with
 * the others as they are stored.
 */
function NoticeEditor({ kind, stored, settings }: { kind: Kind; stored: Notice | Announcement; settings: PlatformSettings }) {
  const { t, number } = useI18n();
  const { busy, run } = useRunner();
  const [draft, setDraft] = useState<Notice | Announcement>(stored);

  const problem = noticeProblem(draft);
  const unchanged =
    sameNotice(draft, stored) &&
    (kind === 'maintenance' ||
      ((draft as Announcement).audience === (stored as Announcement).audience && (draft as Announcement).kind === (stored as Announcement).kind));

  const save = () => {
    const next: PlatformSettings =
      kind === 'maintenance' ? { ...settings, maintenance: draft } : { ...settings, announcement: draft as Announcement };
    return run(kind, () => savePlatformSettings(next, kind), t('notices.saved'));
  };

  const counter = (text: string) => (
    <small className={text.length > MAX_NOTICE_LENGTH ? 'field__error' : undefined}>
      {t('notices.remaining', { count: number(MAX_NOTICE_LENGTH - text.length) })}
    </small>
  );

  const now = useNow();
  const status = noticeStatus(draft, now);
  const tone = status === 'showing' ? 'success' : status === 'waiting' ? 'warning' : 'neutral';

  return (
    <Disclosure
      title={t(`notices.${kind}.title`)}
      icon={kind === 'maintenance' ? 'alert' : 'bell'}
      summary={t(`notices.summary.${status}`)}
      tone={tone}
    >
      <p className="muted">{t(`notices.${kind}.hint`)}</p>
      <label className="option">
        <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
        <span>{t('notices.enabled')}</span>
      </label>
      <StatusLine notice={draft} />
      {kind === 'announcement' && (
        <div className="field-row">
          <label className="field">
            <span>{t('notices.kind')}</span>
            <select
              className="select"
              value={(draft as Announcement).kind}
              onChange={(e) => setDraft({ ...(draft as Announcement), kind: e.target.value as AnnouncementKind })}
            >
              {ANNOUNCEMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`notices.kind.${k}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('notices.audience')}</span>
            <select
              className="select"
              value={(draft as Announcement).audience}
              onChange={(e) => setDraft({ ...(draft as Announcement), audience: e.target.value as AnnouncementAudience })}
            >
              {ANNOUNCEMENT_AUDIENCES.map((a) => (
                <option key={a} value={a}>
                  {t(`notices.audience.${a}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <label className="field">
        <span>{t('notices.messageAr')}</span>
        <textarea dir="rtl" rows={3} value={draft.messageAr} onChange={(e) => setDraft({ ...draft, messageAr: e.target.value })} />
        {counter(draft.messageAr)}
      </label>
      <label className="field">
        <span>{t('notices.messageEn')}</span>
        <textarea dir="ltr" rows={3} value={draft.messageEn} onChange={(e) => setDraft({ ...draft, messageEn: e.target.value })} />
        {counter(draft.messageEn)}
      </label>
      <ScheduleFields notice={draft} onChange={setDraft} />
      <LinkFields
        title={t(kind === 'maintenance' ? 'notices.maintenance.linkTitle' : 'notices.announcement.linkTitle')}
        link={draft.link}
        onChange={(link) => setDraft({ ...draft, link })}
      />
      <h3 className="preview-title">{t('notices.preview')}</h3>
      {kind === 'maintenance' ? (
        <MaintenancePreview notice={draft} />
      ) : (
        <AnnouncementPreview announcement={draft as Announcement} />
      )}
      {problem && (
        <p className="field__error" role="alert">
          {t(`notices.problem.${problem}`, { max: problem === 'label-too-long' ? MAX_LABEL_LENGTH : MAX_NOTICE_LENGTH })}
        </p>
      )}
      <button className="btn btn--primary" disabled={unchanged || problem !== null || busy === kind} onClick={() => void save()}>
        {t('notices.save')}
      </button>
    </Disclosure>
  );
}

/** The lowest app build allowed to be used, and where to get the update from. */
function UpdateEditor({ stored, settings }: { stored: RequiredUpdate; settings: PlatformSettings }) {
  const { t, number } = useI18n();
  const { busy, run } = useRunner();
  const [draft, setDraft] = useState<RequiredUpdate>(stored);
  const [build, setBuild] = useState(String(stored.minBuild));

  const parsed = build.trim() === '' ? 0 : Number(build);
  const current: RequiredUpdate = { ...draft, minBuild: parsed };
  const problem = updateProblem(current);
  const unchanged = sameUpdate(current, stored);

  const counter = (text: string) => (
    <small className={text.length > MAX_NOTICE_LENGTH ? 'field__error' : undefined}>
      {t('notices.remaining', { count: number(MAX_NOTICE_LENGTH - text.length) })}
    </small>
  );

  return (
    <Disclosure
      title={t('notices.update.title')}
      icon="download"
      summary={current.minBuild > 0 ? t('notices.update.summaryOn', { build: number(current.minBuild) }) : t('notices.summary.off')}
      tone={current.minBuild > 0 ? 'success' : 'neutral'}
    >
      <p className="muted">{t('notices.update.hint')}</p>
      <p className={`notice-status notice-status--${current.minBuild > 0 ? 'showing' : 'off'}`} role="status">
        {current.minBuild > 0 ? t('notices.update.on', { build: number(current.minBuild) }) : t('notices.update.off')}
      </p>
      <label className="field">
        <span>{t('notices.update.minBuild')}</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_BUILD}
          step={1}
          dir="ltr"
          value={build}
          onChange={(e) => setBuild(e.target.value)}
        />
        <small className="muted">{t('notices.update.minBuildHint')}</small>
      </label>
      <label className="field">
        <span>{t('notices.update.url')}</span>
        <input type="url" dir="ltr" placeholder="https://" value={draft.url} maxLength={300} onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
      </label>
      <label className="field">
        <span>{t('notices.update.messageAr')}</span>
        <textarea dir="rtl" rows={2} value={draft.messageAr} onChange={(e) => setDraft({ ...draft, messageAr: e.target.value })} />
        {counter(draft.messageAr)}
      </label>
      <label className="field">
        <span>{t('notices.update.messageEn')}</span>
        <textarea dir="ltr" rows={2} value={draft.messageEn} onChange={(e) => setDraft({ ...draft, messageEn: e.target.value })} />
        {counter(draft.messageEn)}
      </label>
      <h3 className="preview-title">{t('notices.preview')}</h3>
      <UpdatePreview update={current} />
      {problem && (
        <p className="field__error" role="alert">
          {t(`notices.update.problem.${problem}`, { max: MAX_NOTICE_LENGTH })}
        </p>
      )}
      <button
        className="btn btn--primary"
        disabled={unchanged || problem !== null || busy === 'update'}
        onClick={() => void run('update', () => savePlatformSettings({ ...settings, update: current }, 'update'), t('notices.saved'))}
      >
        {t('notices.save')}
      </button>
    </Disclosure>
  );
}

/** Maintenance, the announcement and the required update, as the mobile apps show them. */
export function NoticesSection() {
  const { t } = useI18n();
  const state = usePlatformSettings();

  if (state.status === 'loading') return <LoadingState />;
  if (state.status === 'error') return <ErrorState message={t('notices.loadFailed')} />;

  const { settings } = state;
  return (
    <>
      <h2 className="section-title">{t('notices.title')}</h2>
      <p className="muted">{t('notices.hint')}</p>
      {/* Keyed by what is stored, so the form follows a change made elsewhere. */}
      <NoticeEditor key={`m-${JSON.stringify(settings.maintenance)}`} kind="maintenance" stored={settings.maintenance} settings={settings} />
      <NoticeEditor key={`a-${JSON.stringify(settings.announcement)}`} kind="announcement" stored={settings.announcement} settings={settings} />
      <UpdateEditor key={`u-${JSON.stringify(settings.update)}`} stored={settings.update} settings={settings} />
    </>
  );
}
