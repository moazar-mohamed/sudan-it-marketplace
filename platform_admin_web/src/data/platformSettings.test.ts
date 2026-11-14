import { describe, expect, it } from 'vitest';
import {
  APP_TEXT,
  cleanNotice,
  DEFAULT_SETTINGS,
  EMPTY_NOTICE,
  fromLocalInput,
  MAX_NOTICE_LENGTH,
  noticeData,
  noticeProblem,
  noticeStatus,
  parsePlatformSettings,
  sameNotice,
  sameUpdate,
  textFor,
  toLocalInput,
  updateProblem,
  type Notice,
  type RequiredUpdate,
} from './platformSettings';

const notice = (extra: Partial<Notice> = {}): Notice => ({ ...EMPTY_NOTICE, ...extra });
const stamp = (iso: string) => ({ toDate: () => new Date(iso) });

describe('platform settings', () => {
  it('reads everything off when there is no document', () => {
    expect(parsePlatformSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.maintenance.enabled).toBe(false);
    expect(DEFAULT_SETTINGS.announcement.enabled).toBe(false);
    expect(DEFAULT_SETTINGS.update.minBuild).toBe(0);
  });

  it('reads all three notices, with their schedule, button, kind and audience', () => {
    const parsed = parsePlatformSettings({
      maintenance: {
        enabled: true,
        messageAr: 'صيانة',
        messageEn: 'Maintenance',
        startsAt: stamp('2026-10-05T10:00:00Z'),
        endsAt: stamp('2026-10-05T12:00:00Z'),
        linkUrl: 'https://status.example.com',
        linkLabelAr: 'الحالة',
        linkLabelEn: 'Status',
      },
      announcement: { enabled: true, messageAr: 'أ', messageEn: 'a', audience: 'companies', kind: 'success' },
      update: { minBuild: 6, url: 'https://example.com/app.apk', messageAr: 'حدّث', messageEn: 'Update' },
    });
    expect(parsed.maintenance.startsAt).toEqual(new Date('2026-10-05T10:00:00Z'));
    expect(parsed.maintenance.endsAt).toEqual(new Date('2026-10-05T12:00:00Z'));
    expect(parsed.maintenance.link).toEqual({ url: 'https://status.example.com', labelAr: 'الحالة', labelEn: 'Status' });
    expect(parsed.announcement).toMatchObject({ audience: 'companies', kind: 'success', startsAt: null, endsAt: null });
    expect(parsed.update).toEqual({ minBuild: 6, url: 'https://example.com/app.apk', messageAr: 'حدّث', messageEn: 'Update' });
  });

  it('reads a document written before the schedule, the button and the update existed', () => {
    const parsed = parsePlatformSettings({
      maintenance: { enabled: true, messageAr: 'صيانة', messageEn: 'Maintenance' },
      announcement: { enabled: true, messageAr: 'أ', messageEn: 'a', audience: 'customers' },
    });
    expect(parsed.maintenance).toEqual(notice({ enabled: true, messageAr: 'صيانة', messageEn: 'Maintenance' }));
    expect(parsed.announcement.kind).toBe('info');
    expect(parsed.announcement.audience).toBe('customers');
    expect(parsed.update).toEqual(DEFAULT_SETTINGS.update);
  });

  it('tolerates missing, mistyped or unknown values: off, empty, everyone, information, no requirement', () => {
    const parsed = parsePlatformSettings({
      maintenance: { enabled: 'yes', messageAr: 5, startsAt: 'soon', linkUrl: 7 },
      announcement: { enabled: true, audience: 'technicians', kind: 'danger' },
      update: { minBuild: '6', url: 4 },
    });
    expect(parsed.maintenance).toEqual(notice());
    expect(parsed.announcement.audience).toBe('all');
    expect(parsed.announcement.kind).toBe('info');
    expect(parsed.update).toEqual(DEFAULT_SETTINGS.update);
    expect(parsePlatformSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(parsePlatformSettings({ update: { minBuild: -3 } }).update.minBuild).toBe(0);
    expect(parsePlatformSettings({ update: { minBuild: 2.5 } }).update.minBuild).toBe(0);
  });
});

describe('what is showing now', () => {
  const NOW = Date.UTC(2026, 9, 5, 11, 0, 0);
  const at = (iso: string) => new Date(iso);

  it('is off when it is switched off, whatever its schedule says', () => {
    expect(noticeStatus(notice({ startsAt: at('2026-10-05T10:00:00Z') }), NOW)).toBe('off');
  });

  it('shows at once when it has no schedule', () => {
    expect(noticeStatus(notice({ enabled: true }), NOW)).toBe('showing');
  });

  it('waits for its start, shows between start and end, and is over at its end', () => {
    const scheduled = notice({ enabled: true, startsAt: at('2026-10-05T12:00:00Z'), endsAt: at('2026-10-05T14:00:00Z') });
    expect(noticeStatus(scheduled, NOW)).toBe('waiting');
    expect(noticeStatus(scheduled, Date.UTC(2026, 9, 5, 12, 0, 0))).toBe('showing');
    expect(noticeStatus(scheduled, Date.UTC(2026, 9, 5, 13, 59, 59))).toBe('showing');
    expect(noticeStatus(scheduled, Date.UTC(2026, 9, 5, 14, 0, 0))).toBe('ended');
  });

  it('runs until it is turned off when it has only a start, and starts now when it has only an end', () => {
    expect(noticeStatus(notice({ enabled: true, startsAt: at('2026-10-01T00:00:00Z') }), NOW)).toBe('showing');
    expect(noticeStatus(notice({ enabled: true, endsAt: at('2026-10-06T00:00:00Z') }), NOW)).toBe('showing');
    expect(noticeStatus(notice({ enabled: true, endsAt: at('2026-10-05T10:00:00Z') }), NOW)).toBe('ended');
  });
});

describe('what cannot be saved', () => {
  it('a notice that is on needs some text, in either language', () => {
    expect(noticeProblem(notice({ enabled: true }))).toBe('empty-while-on');
    expect(noticeProblem(notice({ enabled: true, messageAr: '   ' }))).toBe('empty-while-on');
    expect(noticeProblem(notice({ enabled: true, messageEn: 'Back soon' }))).toBeNull();
    expect(noticeProblem(notice({ enabled: false }))).toBeNull();
  });

  it('a text may have at most 300 characters', () => {
    expect(noticeProblem(notice({ messageEn: 'x'.repeat(MAX_NOTICE_LENGTH) }))).toBeNull();
    expect(noticeProblem(notice({ messageAr: 'x'.repeat(MAX_NOTICE_LENGTH + 1) }))).toBe('too-long');
  });

  it('the end must be after the start', () => {
    const a = new Date('2026-10-05T10:00:00Z');
    expect(noticeProblem(notice({ startsAt: a, endsAt: new Date('2026-10-05T10:00:01Z') }))).toBeNull();
    expect(noticeProblem(notice({ startsAt: a, endsAt: a }))).toBe('bad-schedule');
    expect(noticeProblem(notice({ startsAt: a, endsAt: new Date('2026-10-05T09:00:00Z') }))).toBe('bad-schedule');
    expect(noticeProblem(notice({ startsAt: a }))).toBeNull();
  });

  it('a button needs an https link and a label', () => {
    const link = (url: string, labelAr = '', labelEn = '') => notice({ link: { url, labelAr, labelEn } });
    expect(noticeProblem(link('https://example.com', '', 'Open'))).toBeNull();
    expect(noticeProblem(link('https://example.com', 'افتح'))).toBeNull();
    expect(noticeProblem(link('https://example.com'))).toBe('link-needs-label');
    expect(noticeProblem(link('http://example.com', '', 'Open'))).toBe('bad-link');
    expect(noticeProblem(link('javascript:alert(1)', '', 'Open'))).toBe('bad-link');
    expect(noticeProblem(link('https://exa mple.com', '', 'Open'))).toBe('bad-link');
    expect(noticeProblem(link('', '', ''))).toBeNull();
    expect(noticeProblem(link('', '', 'A label alone is harmless'))).toBeNull();
    expect(noticeProblem(link('https://example.com', '', 'x'.repeat(41)))).toBe('label-too-long');
  });

  it('a required update needs a whole build number and, once it is on, a page to update from', () => {
    const update = (extra: Partial<RequiredUpdate> = {}): RequiredUpdate => ({ minBuild: 0, url: '', messageAr: '', messageEn: '', ...extra });
    expect(updateProblem(update())).toBeNull();
    expect(updateProblem(update({ minBuild: 6, url: 'https://example.com/app.apk' }))).toBeNull();
    expect(updateProblem(update({ minBuild: 6 }))).toBe('bad-link');
    expect(updateProblem(update({ minBuild: 6, url: 'http://example.com' }))).toBe('bad-link');
    expect(updateProblem(update({ url: 'ftp://x' }))).toBe('bad-link');
    expect(updateProblem(update({ minBuild: -1, url: 'https://example.com' }))).toBe('bad-build');
    expect(updateProblem(update({ minBuild: 1.5, url: 'https://example.com' }))).toBe('bad-build');
    expect(updateProblem(update({ minBuild: NaN, url: 'https://example.com' }))).toBe('bad-build');
    expect(updateProblem(update({ minBuild: 1_000_001, url: 'https://example.com' }))).toBe('bad-build');
    expect(updateProblem(update({ messageEn: 'x'.repeat(301) }))).toBe('too-long');
  });
});

describe('writing and comparing', () => {
  it('trims the texts and the button before they are stored', () => {
    const cleaned = cleanNotice(notice({ messageAr: ' أ ', messageEn: ' a ', link: { url: ' https://x.test ', labelAr: ' ب ', labelEn: ' b ' } }));
    expect(cleaned.messageAr).toBe('أ');
    expect(cleaned.link).toEqual({ url: 'https://x.test', labelAr: 'ب', labelEn: 'b' });
  });

  it('stores the button as flat keys and keeps the dates', () => {
    const a = new Date('2026-10-05T10:00:00Z');
    expect(noticeData(notice({ enabled: true, messageEn: ' Hi ', startsAt: a, link: { url: 'https://x.test', labelAr: '', labelEn: 'Go' } }))).toEqual({
      enabled: true,
      messageAr: '',
      messageEn: 'Hi',
      startsAt: a,
      endsAt: null,
      linkUrl: 'https://x.test',
      linkLabelAr: '',
      linkLabelEn: 'Go',
    });
  });

  it('knows a notice has not changed once spaces and equal dates are ignored', () => {
    const a = notice({ messageEn: 'Hi', startsAt: new Date('2026-10-05T10:00:00Z') });
    expect(sameNotice(a, notice({ messageEn: ' Hi ', startsAt: new Date('2026-10-05T10:00:00Z') }))).toBe(true);
    expect(sameNotice(a, notice({ messageEn: 'Hi', startsAt: new Date('2026-10-05T10:01:00Z') }))).toBe(false);
    expect(sameNotice(a, notice({ messageEn: 'Hi', startsAt: new Date('2026-10-05T10:00:00Z'), link: { url: 'https://x.test', labelAr: '', labelEn: 'Go' } }))).toBe(false);
    expect(sameUpdate({ minBuild: 6, url: ' https://x.test ', messageAr: '', messageEn: '' }, { minBuild: 6, url: 'https://x.test', messageAr: '', messageEn: '' })).toBe(true);
    expect(sameUpdate(DEFAULT_SETTINGS.update, { ...DEFAULT_SETTINGS.update, minBuild: 1 })).toBe(false);
  });

  it('turns a date into a datetime-local value and back, empty meaning none', () => {
    const date = new Date(2026, 9, 5, 14, 30);
    expect(toLocalInput(date)).toBe('2026-10-05T14:30');
    expect(fromLocalInput('2026-10-05T14:30')).toEqual(date);
    expect(toLocalInput(null)).toBe('');
    expect(fromLocalInput('')).toBeNull();
    expect(fromLocalInput('not a date')).toBeNull();
  });
});

describe('the words around a notice in the apps', () => {
  it('shows the reader their language, else the other one, else nothing', () => {
    expect(textFor('ar', 'مرحبا', 'Hello')).toBe('مرحبا');
    expect(textFor('en', 'مرحبا', 'Hello')).toBe('Hello');
    expect(textFor('ar', '', 'Hello')).toBe('Hello');
    expect(textFor('en', 'مرحبا', '  ')).toBe('مرحبا');
    expect(textFor('en', '', '')).toBeNull();
  });

  it('has the fixed words in both languages', () => {
    for (const lang of ['ar', 'en'] as const) {
      expect(Object.values(APP_TEXT[lang]).every((v) => v.length > 0)).toBe(true);
    }
    expect(APP_TEXT.en.backAt).toContain('{time}');
    expect(APP_TEXT.ar.backAt).toContain('{time}');
  });
});
