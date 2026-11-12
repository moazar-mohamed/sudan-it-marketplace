import { language, t } from '../i18n';

/** The locale for month names (digits stay 0-9 in both). */
const LOCALE = language === 'en' ? 'en-GB' : 'ar-SD-u-nu-latn';

/** 7500 → "7,500" (whole numbers, as the app). */
export const money = (value: number): string => Math.round(value).toLocaleString('en-US');

/** "7,500 SDG": installation fees are in SDG, as in the app. */
export const sdg = (value: number): string => `${money(value)} SDG`;

const pad = (n: number) => String(n).padStart(2, '0');

export const dateTime = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const clock = (d: Date): string => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const dayMonth = (d: Date): string => d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'long' });

/** "اليوم 09:12", "أمس 17:20", else "30 أكتوبر". */
export function dayTime(d: Date, now = new Date()): string {
  if (sameDay(d, now)) return t('اليوم {0}', clock(d));
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return t('أمس {0}', clock(d));
  return dayMonth(d);
}

/** "12 نوفمبر 16:40". */
export const dayMonthTime = (d: Date): string => `${dayMonth(d)} ${clock(d)}`;

/** For a chat list: the time today, "أمس", else the date. */
export function shortWhen(d: Date, now = new Date()): string {
  if (sameDay(d, now)) return clock(d);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return t('أمس');
  return dayMonth(d);
}

/** When a job arrived: "وصلت اليوم 08:40", "وصلت أمس", "وصلت منذ يومين", "وصلت منذ 5 أيام". */
export function arrived(d: Date, now = new Date()): string {
  if (sameDay(d, now)) return t('وصلت اليوم {0}', clock(d));
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return t('وصلت أمس');
  const days = Math.max(2, Math.round((now.getTime() - d.getTime()) / 86_400_000));
  if (days === 2) return t('وصلت منذ يومين');
  if (days <= 10) return t('وصلت منذ {0} أيام', days);
  return t('وصلت في {0}', dayMonth(d));
}
