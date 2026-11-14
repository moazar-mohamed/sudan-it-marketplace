import { describe, expect, it } from 'vitest';
import { platformNoticeOf } from './platformNotice';
import { titleWithCount } from './titleCount';
import { MAX_PUSH_TOKENS, needsHomeScreen, nextPushTokens, VAPID_KEY } from './webPush';

describe('the devices a person keeps for pushes', () => {
  it('adds this browser last, and moves it last when it is known', () => {
    expect(nextPushTokens(['phone'], 'web')).toEqual(['phone', 'web']);
    expect(nextPushTokens(['web', 'phone'], 'web')).toEqual(['phone', 'web']);
  });

  it('keeps the newest eight, phones and browsers together, as the app does', () => {
    expect(MAX_PUSH_TOKENS).toBe(8);
    const seven = ['1', '2', '3', '4', '5', '6', '7'];
    expect(nextPushTokens(seven, '8')).toEqual([...seven, '8']);
    expect(nextPushTokens([...seven, '8'], '9')).toEqual(['2', '3', '4', '5', '6', '7', '8', '9']);
  });

  it('reads a missing or broken list as empty', () => {
    expect(nextPushTokens(undefined, 'web')).toEqual(['web']);
    expect(nextPushTokens(['a', 3, null], 'web')).toEqual(['a', 'web']);
  });

  it('uses the project\'s own Web Push key (a P-256 public key)', () => {
    const bytes = atob(VAPID_KEY.replace(/-/g, '+').replace(/_/g, '/'));
    expect(bytes.length).toBe(65);
    expect(bytes.charCodeAt(0)).toBe(4);
  });
});

describe('an iPhone needs the site on its Home Screen first', () => {
  const nav = (userAgent: string, platform = '', maxTouchPoints = 0) => ({ userAgent, platform, maxTouchPoints }) as Navigator;

  it('says so in Safari on an iPhone or an iPad', () => {
    expect(needsHomeScreen(nav('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), false)).toBe(true);
    expect(needsHomeScreen(nav('Mozilla/5.0 (Macintosh)', 'MacIntel', 5), false)).toBe(true);
  });

  it('not once it is opened from the Home Screen, nor on other devices', () => {
    expect(needsHomeScreen(nav('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), true)).toBe(false);
    expect(needsHomeScreen(nav('Mozilla/5.0 (Linux; Android 14)'), false)).toBe(false);
    expect(needsHomeScreen(nav('Mozilla/5.0 (Macintosh)', 'MacIntel', 0), false)).toBe(false);
  });
});

describe('the count in the tab title', () => {
  it('puts the number in front, once, and takes it off', () => {
    expect(titleWithCount('Sudan ICT', 3)).toBe('(3) Sudan ICT');
    expect(titleWithCount('(3) Sudan ICT', 5)).toBe('(5) Sudan ICT');
    expect(titleWithCount('(5) Sudan ICT', 0)).toBe('Sudan ICT');
    expect(titleWithCount('Sudan ICT', 150)).toBe('(99+) Sudan ICT');
    expect(titleWithCount('(99+) Sudan ICT', 0)).toBe('Sudan ICT');
  });
});

describe('the notice to the Platform Admins', () => {
  it('a new report: addressed to the whole team, keyed by the report, named by its subject', () => {
    const { id, data } = platformNoticeOf({ type: 'new_report', reportId: 'r1' }, 'cust1', 'Late delivery');
    expect(id).toBe('r1_new_report');
    expect(data).toMatchObject({
      id: 'r1_new_report',
      recipientType: 'platform_admin',
      recipientId: 'platform',
      reportId: 'r1',
      type: 'new_report',
      productName: 'Late delivery',
      isRead: false,
      senderId: 'cust1',
    });
    expect(data).not.toHaveProperty('reviewId');
    expect(data).not.toHaveProperty('title');
  });

  it('a low rating: keyed by the review, named by what was rated', () => {
    const { id, data } = platformNoticeOf({ type: 'low_review', reviewId: 'v1' }, 'cust1', 'Printer X');
    expect(id).toBe('v1_low_review');
    expect(data).toMatchObject({ reviewId: 'v1', type: 'low_review', productName: 'Printer X' });
    expect(data).not.toHaveProperty('reportId');
  });
});
