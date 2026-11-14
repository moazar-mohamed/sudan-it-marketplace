import { describe, expect, it } from 'vitest';
import { mapPlatformNotice, platformNoticeTarget } from './platformNotices';
import { MAX_PUSH_TOKENS, nextPushTokens } from './webPush';

describe('notices to the Platform Admins', () => {
  const at = { toDate: () => new Date('2026-11-05T10:00:00Z') };

  it('reads a new report and a low rating, with the subject as its name', () => {
    expect(mapPlatformNotice('r1_new_report', { type: 'new_report', reportId: 'r1', productName: 'Late delivery', isRead: false, createdAt: at })).toEqual({
      id: 'r1_new_report',
      type: 'new_report',
      reportId: 'r1',
      reviewId: '',
      name: 'Late delivery',
      isRead: false,
      createdAt: new Date('2026-11-05T10:00:00Z'),
    });
    expect(mapPlatformNotice('v1_low_review', { type: 'low_review', reviewId: 'v1', productName: 'Printer X', isRead: true })?.reviewId).toBe('v1');
  });

  it('leaves out a kind it does not know', () => {
    expect(mapPlatformNotice('x', { type: 'new_order', productName: 'x' })).toBeNull();
  });

  it('a report opens the reports, a low rating the low ratings', () => {
    const report = mapPlatformNotice('r', { type: 'new_report' })!;
    const review = mapPlatformNotice('v', { type: 'low_review' })!;
    expect(platformNoticeTarget(report)).toBe('/reports');
    expect(platformNoticeTarget(review)).toBe('/reviews?attention=low');
  });
});

describe('the devices an admin keeps for pushes', () => {
  it('keeps the newest eight, this browser last', () => {
    expect(MAX_PUSH_TOKENS).toBe(8);
    expect(nextPushTokens(['1', '2', '3', '4', '5', '6', '7', '8'], '1')).toEqual(['2', '3', '4', '5', '6', '7', '8', '1']);
  });
});
