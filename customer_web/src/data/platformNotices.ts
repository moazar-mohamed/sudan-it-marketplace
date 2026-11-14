import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import { countText } from './format';
import { t } from '../i18n';

// Port of platform_notices.dart: the Platform Admin's maintenance notice and
// announcement. The "update required" notice is for app builds only: a web page
// is always the latest one.

const DISMISSED_KEY = 'dismissed_announcement';
const CLOCK_MS = 30 * 1000;
/** How long before a scheduled maintenance the customer is warned. */
const WARN_BEFORE_MS = 60 * 60 * 1000;

export type NoticeKind = 'info' | 'warning' | 'success';
export type NoticeAudience = 'all' | 'customers' | 'companies';

export interface NoticeLink {
  url: string;
  label: string;
}

export interface PlatformNotice {
  enabled: boolean;
  messageAr: string;
  messageEn: string;
  /** null = from the moment it is switched on. */
  startsAt: Date | null;
  /** null = until it is switched off. */
  endsAt: Date | null;
  link: NoticeLink | null;
}

export interface PlatformNotices {
  maintenance: PlatformNotice;
  announcement: PlatformNotice;
  audience: NoticeAudience;
  kind: NoticeKind;
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function time(v: unknown): Date | null {
  const fn = (v as { toDate?: () => Date } | null | undefined)?.toDate;
  return typeof fn === 'function' ? fn.call(v) : null;
}

/** Only an https link counts: a mistake in the document can never open something else. */
function linkOf(map: DocumentData): NoticeLink | null {
  const url = text(map.linkUrl);
  const label = text(map.linkLabelAr) || text(map.linkLabelEn);
  if (!label) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname ? { url, label } : null;
  } catch {
    return null;
  }
}

function parseNotice(data: unknown): PlatformNotice {
  const map = (data && typeof data === 'object' ? data : {}) as DocumentData;
  return {
    enabled: map.enabled === true,
    messageAr: text(map.messageAr),
    messageEn: text(map.messageEn),
    startsAt: time(map.startsAt),
    endsAt: time(map.endsAt),
    link: linkOf(map),
  };
}

export function parseNotices(data: DocumentData | undefined): PlatformNotices {
  const announcement = (data?.announcement ?? {}) as DocumentData;
  const audience = announcement.audience;
  const kind = announcement.kind;
  return {
    maintenance: parseNotice(data?.maintenance),
    announcement: parseNotice(announcement),
    audience: audience === 'customers' || audience === 'companies' ? audience : 'all',
    kind: kind === 'warning' || kind === 'success' ? kind : 'info',
  };
}

/** Also what the site assumes while loading or unreadable: a broken connection never locks anyone out. */
export const NO_NOTICES = parseNotices(undefined);

export function isActiveAt(n: PlatformNotice, now: Date): boolean {
  if (!n.enabled) return false;
  if (n.startsAt && now < n.startsAt) return false;
  return !(n.endsAt && now >= n.endsAt);
}

/** The Arabic text, or the English when there is none; null when nothing is to be shown now. */
export const noticeText = (n: PlatformNotice, now: Date): string | null =>
  isActiveAt(n, now) ? n.messageAr || n.messageEn || null : null;

export const hasSchedule = (n: PlatformNotices): boolean =>
  [n.maintenance, n.announcement].some((x) => x.startsAt !== null || x.endsAt !== null);

/** A visitor who is not signed in sees only announcements meant for everyone. */
export const announcementIsFor = (n: PlatformNotices, signedIn: boolean): boolean =>
  n.audience === 'all' || (n.audience === 'customers' && signedIn);

/** Who dismissed an announcement sees it again only when what it says changes. */
export const announcementKey = (n: PlatformNotices): string =>
  [n.audience, n.kind, n.announcement.messageAr, n.announcement.messageEn, n.announcement.link?.url ?? ''].join('|');

/** When a maintenance that has not begun yet starts, if that is within the warning time. */
export function upcomingMaintenance(n: PlatformNotice, now: Date): Date | null {
  if (!n.enabled || !n.startsAt || n.startsAt <= now) return null;
  if (!(n.messageAr || n.messageEn)) return null;
  return n.startsAt.getTime() - now.getTime() <= WARN_BEFORE_MS ? n.startsAt : null;
}

/** "ساعتان 15 د", "40 دقيقة", "3 أيام": rounded up, so "0 minutes" never shows while time is left. */
export function durationText(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  if (minutes >= 48 * 60) return countText(Math.floor(minutes / 1440), t('يوم'), t('يومين'), t('أيام'), t('يوماً'));
  if (minutes >= 60) return t('{0} س {1} د', Math.floor(minutes / 60), minutes % 60);
  return countText(minutes, t('دقيقة'), t('دقيقتين'), t('دقائق'), t('دقيقة'));
}

export function useNotices(): PlatformNotices {
  const [notices, setNotices] = useState(NO_NOTICES);
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'platform_settings', 'public'),
        (snap) => setNotices(parseNotices(snap.data())),
        () => setNotices(NO_NOTICES),
      ),
    [],
  );
  return notices;
}

/** The time, kept current only while some notice has a start or an end to wait for. */
export function useNow(running: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    setNow(new Date());
    if (!running) return;
    const timer = window.setInterval(() => setNow(new Date()), CLOCK_MS);
    return () => window.clearInterval(timer);
  }, [running]);
  return now;
}

export function loadDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

export function saveDismissed(key: string): void {
  try {
    localStorage.setItem(DISMISSED_KEY, key);
  } catch {
    // It only comes back on the next visit.
  }
}
