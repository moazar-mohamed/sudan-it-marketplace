import { describe, expect, it, vi } from 'vitest';

vi.mock('../firebase', () => ({ db: {} }));

import {
  announcementIsFor,
  announcementKey,
  durationText,
  isActiveAt,
  noticeText,
  parseNotices,
  upcomingMaintenance,
} from './platformNotices';

const stamp = (d: Date) => ({ toDate: () => d });
const at = (hour: number, minute = 0): Date => new Date(2026, 0, 1, hour, minute);

describe('notices', () => {
  it('assumes nothing when the document is missing', () => {
    const n = parseNotices(undefined);
    expect(noticeText(n.maintenance, at(10))).toBeNull();
    expect(n.audience).toBe('all');
    expect(n.kind).toBe('info');
  });

  it('follows its schedule: it starts at the start and is over at the end', () => {
    const { maintenance } = parseNotices({ maintenance: { enabled: true, messageAr: 'صيانة', startsAt: stamp(at(10)), endsAt: stamp(at(12)) } });
    expect(isActiveAt(maintenance, at(9, 59))).toBe(false);
    expect(isActiveAt(maintenance, at(10))).toBe(true);
    expect(isActiveAt(maintenance, at(11, 59))).toBe(true);
    expect(isActiveAt(maintenance, at(12))).toBe(false);
  });

  it('is off when switched off, whatever the schedule says', () => {
    const { maintenance } = parseNotices({ maintenance: { enabled: false, messageAr: 'صيانة' } });
    expect(noticeText(maintenance, at(10))).toBeNull();
  });

  it('falls back to English, and shows nothing without any text', () => {
    expect(noticeText(parseNotices({ maintenance: { enabled: true, messageEn: 'Down' } }).maintenance, at(10))).toBe('Down');
    expect(noticeText(parseNotices({ maintenance: { enabled: true } }).maintenance, at(10))).toBeNull();
  });

  it('keeps only an https link with a label', () => {
    const link = (map: object) => parseNotices({ announcement: { enabled: true, messageAr: 'x', ...map } }).announcement.link;
    expect(link({ linkUrl: 'https://example.com/a', linkLabelAr: 'افتح' })).toEqual({ url: 'https://example.com/a', label: 'افتح' });
    expect(link({ linkUrl: 'https://example.com/a', linkLabelEn: 'Open' })?.label).toBe('Open');
    expect(link({ linkUrl: 'http://example.com', linkLabelAr: 'افتح' })).toBeNull();
    expect(link({ linkUrl: 'javascript:alert(1)', linkLabelAr: 'افتح' })).toBeNull();
    expect(link({ linkUrl: 'https://example.com' })).toBeNull();
  });

  it('shows an announcement to the people it is for', () => {
    expect(announcementIsFor(parseNotices({ announcement: { audience: 'all' } }), false)).toBe(true);
    expect(announcementIsFor(parseNotices({ announcement: { audience: 'customers' } }), false)).toBe(false);
    expect(announcementIsFor(parseNotices({ announcement: { audience: 'customers' } }), true)).toBe(true);
    expect(announcementIsFor(parseNotices({ announcement: { audience: 'companies' } }), true)).toBe(false);
  });

  it('brings back a dismissed announcement only when its content changes', () => {
    const first = parseNotices({ announcement: { messageAr: 'أ', startsAt: stamp(at(1)) } });
    const sameWords = parseNotices({ announcement: { messageAr: 'أ', startsAt: stamp(at(2)) } });
    const newWords = parseNotices({ announcement: { messageAr: 'ب' } });
    expect(announcementKey(first)).toBe(announcementKey(sameWords));
    expect(announcementKey(first)).not.toBe(announcementKey(newWords));
  });

  it('warns only in the hour before a maintenance begins', () => {
    const { maintenance } = parseNotices({ maintenance: { enabled: true, messageAr: 'صيانة', startsAt: stamp(at(12)) } });
    expect(upcomingMaintenance(maintenance, at(10, 59))).toBeNull();
    expect(upcomingMaintenance(maintenance, at(11))).toEqual(at(12));
    expect(upcomingMaintenance(maintenance, at(12))).toBeNull();
  });

  it('never says zero minutes', () => {
    expect(durationText(1000)).toContain('دقيقة');
    expect(durationText(90 * 60000)).toBe('1 س 30 د');
    expect(durationText(3 * 86400000)).toContain('3');
  });
});
