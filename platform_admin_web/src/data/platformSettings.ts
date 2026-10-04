import type { DocumentData } from 'firebase/firestore';
import { toDate } from './mappers';

/*
 * Platform-wide notices (platform_settings/public). One document holds three:
 *  - a maintenance notice the apps show instead of the app while it is on,
 *  - an announcement banner for everyone, customers or companies,
 *  - a required update: the lowest app build allowed to be used.
 * Maintenance and the announcement each have an Arabic and an English text (at
 * most 300 characters, some text required while on), an optional schedule that
 * turns them on and off by itself, and an optional button that opens a page.
 * The rules check every limit below again.
 */

export const MAX_NOTICE_LENGTH = 300;
export const MAX_LABEL_LENGTH = 40;
export const MAX_URL_LENGTH = 300;
export const MAX_BUILD = 1_000_000;

export const ANNOUNCEMENT_AUDIENCES = ['all', 'customers', 'companies'] as const;
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

export const ANNOUNCEMENT_KINDS = ['info', 'warning', 'success'] as const;
export type AnnouncementKind = (typeof ANNOUNCEMENT_KINDS)[number];

/** A button under a notice that opens a page (https only). */
export interface NoticeLink {
  url: string;
  labelAr: string;
  labelEn: string;
}

export interface Notice {
  enabled: boolean;
  messageAr: string;
  messageEn: string;
  /** null = starts as soon as it is on. */
  startsAt: Date | null;
  /** null = runs until it is turned off. */
  endsAt: Date | null;
  link: NoticeLink;
}

export interface Announcement extends Notice {
  audience: AnnouncementAudience;
  kind: AnnouncementKind;
}

/** Apps with a build number below `minBuild` must update before they can be used. 0 = no requirement. */
export interface RequiredUpdate {
  minBuild: number;
  url: string;
  messageAr: string;
  messageEn: string;
}

export interface PlatformSettings {
  maintenance: Notice;
  announcement: Announcement;
  update: RequiredUpdate;
}

const NO_LINK: NoticeLink = { url: '', labelAr: '', labelEn: '' };

export const EMPTY_NOTICE: Notice = {
  enabled: false,
  messageAr: '',
  messageEn: '',
  startsAt: null,
  endsAt: null,
  link: NO_LINK,
};

export const DEFAULT_SETTINGS: PlatformSettings = {
  maintenance: EMPTY_NOTICE,
  announcement: { ...EMPTY_NOTICE, audience: 'all', kind: 'info' },
  update: { minBuild: 0, url: '', messageAr: '', messageEn: '' },
};

const str = (v: unknown) => (typeof v === 'string' ? v : '');

const readNotice = (v: unknown): Notice => {
  const d = (v && typeof v === 'object' ? v : {}) as DocumentData;
  return {
    enabled: d.enabled === true,
    messageAr: str(d.messageAr),
    messageEn: str(d.messageEn),
    startsAt: toDate(d.startsAt),
    endsAt: toDate(d.endsAt),
    link: { url: str(d.linkUrl), labelAr: str(d.linkLabelAr), labelEn: str(d.linkLabelEn) },
  };
};

const readUpdate = (v: unknown): RequiredUpdate => {
  const d = (v && typeof v === 'object' ? v : {}) as DocumentData;
  const build = typeof d.minBuild === 'number' && Number.isInteger(d.minBuild) && d.minBuild > 0 ? d.minBuild : 0;
  return { minBuild: build, url: str(d.url), messageAr: str(d.messageAr), messageEn: str(d.messageEn) };
};

/** The stored settings, tolerating a missing document or missing fields (an older document has no schedule, button or update). */
export function parsePlatformSettings(data: DocumentData | undefined): PlatformSettings {
  if (!data) return DEFAULT_SETTINGS;
  const announcement = (data.announcement ?? {}) as DocumentData;
  return {
    maintenance: readNotice(data.maintenance),
    announcement: {
      ...readNotice(data.announcement),
      audience: ANNOUNCEMENT_AUDIENCES.find((a) => a === announcement.audience) ?? 'all',
      kind: ANNOUNCEMENT_KINDS.find((k) => k === announcement.kind) ?? 'info',
    },
    update: readUpdate(data.update),
  };
}

/** The notice as the database stores it (flat keys; dates are left for the caller to turn into timestamps). */
export function noticeData(notice: Notice) {
  return {
    enabled: notice.enabled,
    messageAr: notice.messageAr.trim(),
    messageEn: notice.messageEn.trim(),
    startsAt: notice.startsAt,
    endsAt: notice.endsAt,
    linkUrl: notice.link.url.trim(),
    linkLabelAr: notice.link.labelAr.trim(),
    linkLabelEn: notice.link.labelEn.trim(),
  };
}

/* ---------- what is showing now ---------- */

export type NoticeStatus = 'off' | 'waiting' | 'showing' | 'ended';

/** Whether a notice is showing at `now`: switched on and inside its schedule. The apps apply the same rule. */
export function noticeStatus(notice: Pick<Notice, 'enabled' | 'startsAt' | 'endsAt'>, now: number): NoticeStatus {
  if (!notice.enabled) return 'off';
  if (notice.startsAt && now < notice.startsAt.getTime()) return 'waiting';
  if (notice.endsAt && now >= notice.endsAt.getTime()) return 'ended';
  return 'showing';
}

/* ---------- what cannot be saved ---------- */

export type NoticeProblem =
  | 'too-long'
  | 'empty-while-on'
  | 'bad-schedule'
  | 'bad-link'
  | 'link-needs-label'
  | 'label-too-long';

export const isHttpsUrl = (url: string) => /^https:\/\/\S+$/.test(url) && url.length <= MAX_URL_LENGTH;

/** Why a notice cannot be saved (the same rules the database enforces), or null. */
export function noticeProblem(notice: Notice): NoticeProblem | null {
  if (notice.messageAr.length > MAX_NOTICE_LENGTH || notice.messageEn.length > MAX_NOTICE_LENGTH) return 'too-long';
  if (notice.enabled && !notice.messageAr.trim() && !notice.messageEn.trim()) return 'empty-while-on';
  if (notice.startsAt && notice.endsAt && notice.endsAt.getTime() <= notice.startsAt.getTime()) return 'bad-schedule';
  const { url, labelAr, labelEn } = notice.link;
  if (labelAr.trim().length > MAX_LABEL_LENGTH || labelEn.trim().length > MAX_LABEL_LENGTH) return 'label-too-long';
  if (url.trim()) {
    if (!isHttpsUrl(url.trim())) return 'bad-link';
    if (!labelAr.trim() && !labelEn.trim()) return 'link-needs-label';
  }
  return null;
}

export type UpdateProblem = 'too-long' | 'bad-build' | 'bad-link';

export function updateProblem(update: RequiredUpdate): UpdateProblem | null {
  if (update.messageAr.length > MAX_NOTICE_LENGTH || update.messageEn.length > MAX_NOTICE_LENGTH) return 'too-long';
  if (!Number.isInteger(update.minBuild) || update.minBuild < 0 || update.minBuild > MAX_BUILD) return 'bad-build';
  // The download page is what the "Update" button opens: asking for an update without one traps people.
  if (update.minBuild > 0 && !isHttpsUrl(update.url.trim())) return 'bad-link';
  if (update.url.trim() && !isHttpsUrl(update.url.trim())) return 'bad-link';
  return null;
}

/** The notice as it is written: texts trimmed. */
export const cleanNotice = <T extends Notice>(notice: T): T => ({
  ...notice,
  messageAr: notice.messageAr.trim(),
  messageEn: notice.messageEn.trim(),
  link: {
    url: notice.link.url.trim(),
    labelAr: notice.link.labelAr.trim(),
    labelEn: notice.link.labelEn.trim(),
  },
});

export const cleanUpdate = (update: RequiredUpdate): RequiredUpdate => ({
  ...update,
  url: update.url.trim(),
  messageAr: update.messageAr.trim(),
  messageEn: update.messageEn.trim(),
});

/* ---------- date fields ---------- */

const pad = (n: number) => String(n).padStart(2, '0');

/** A date as the value of an <input type="datetime-local"> (the browser's own time zone). */
export const toLocalInput = (date: Date | null): string =>
  date
    ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
    : '';

/** The date an <input type="datetime-local"> holds; null when it is empty or not a date. */
export const fromLocalInput = (value: string): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
};

/* ---------- comparing and previewing ---------- */

/** Whether two notices say the same thing once written (texts trimmed, dates compared by time). */
export const sameNotice = (a: Notice, b: Notice): boolean => JSON.stringify(noticeData(a)) === JSON.stringify(noticeData(b));

export const sameUpdate = (a: RequiredUpdate, b: RequiredUpdate): boolean =>
  JSON.stringify(cleanUpdate(a)) === JSON.stringify(cleanUpdate(b));

export type Lang = 'ar' | 'en';

/** The fixed words the mobile apps put around a notice (kept in step with the app's l10n files). */
export const APP_TEXT: Record<
  Lang,
  { maintenanceTitle: string; tryLater: string; backAt: string; dismiss: string; updateTitle: string; updateBody: string; updateButton: string }
> = {
  ar: {
    maintenanceTitle: 'المنصة تحت الصيانة',
    tryLater: 'يرجى المحاولة مرة أخرى بعد قليل.',
    backAt: 'العودة المتوقعة: {time}',
    dismiss: 'إغلاق',
    updateTitle: 'تحديث مطلوب',
    updateBody: 'يلزم إصدار أحدث من التطبيق لمتابعة استخدامه.',
    updateButton: 'تحديث',
  },
  en: {
    maintenanceTitle: 'Under maintenance',
    tryLater: 'Please try again in a little while.',
    backAt: 'Expected back: {time}',
    dismiss: 'Dismiss',
    updateTitle: 'Update required',
    updateBody: 'A newer version of the app is needed to keep using it.',
    updateButton: 'Update',
  },
};

/** The text a reader of `lang` sees: theirs, or the other language's when theirs is empty; null when both are empty. */
export const textFor = (lang: Lang, ar: string, en: string): string | null => {
  const preferred = (lang === 'ar' ? ar : en).trim();
  const other = (lang === 'ar' ? en : ar).trim();
  return preferred || other || null;
};
