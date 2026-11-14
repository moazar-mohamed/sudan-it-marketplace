// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { savePlatformSettings } from '../data/actions';
import { DEFAULT_SETTINGS, EMPTY_NOTICE, type PlatformSettings } from '../data/platformSettings';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { ToastProvider } from './feedback';
import { NoticesSection } from './NoticesCard';

const mock = vi.hoisted(() => ({
  state: { status: 'ready', settings: null as unknown } as { status: string; settings: unknown },
}));

vi.mock('../data/usePlatformSettings', () => ({ usePlatformSettings: () => mock.state }));
vi.mock('../data/actions', () => ({ savePlatformSettings: vi.fn() }));

const show = (settings: PlatformSettings = DEFAULT_SETTINGS, status = 'ready') => {
  mock.state = { status, settings };
  render(
    <I18nProvider>
      <ToastProvider>
        <NoticesSection />
      </ToastProvider>
    </I18nProvider>,
  );
};

/** The card with this title, opened (they start closed). */
const card = (title: string) => {
  const found = screen.getByText(title).closest('.card') as HTMLElement;
  const head = found.querySelector('button[aria-expanded="false"]');
  if (head) fireEvent.click(head);
  return found;
};
const saveButton = (title: string) => within(card(title)).getByRole('button', { name: en['notices.save'] }) as HTMLButtonElement;
const field = (title: string, label: string) =>
  within(card(title)).getByText(label).closest('label')!.querySelector('textarea,input') as HTMLTextAreaElement;
const MAINTENANCE = en['notices.maintenance.title'];
const ANNOUNCEMENT = en['notices.announcement.title'];
const UPDATE = en['notices.update.title'];

beforeEach(() => {
  vi.mocked(savePlatformSettings).mockReset();
  vi.mocked(savePlatformSettings).mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('Notices in the apps', () => {
  it('shows the three notices, off, with nothing to save yet', () => {
    show();
    expect(card(MAINTENANCE)).toBeTruthy();
    expect(card(ANNOUNCEMENT)).toBeTruthy();
    expect(card(UPDATE)).toBeTruthy();
    for (const title of [MAINTENANCE, ANNOUNCEMENT, UPDATE]) expect(saveButton(title).disabled).toBe(true);
  });

  it('loads and fails without a form', () => {
    show(DEFAULT_SETTINGS, 'loading');
    expect(screen.queryByText(MAINTENANCE)).toBeNull();
    cleanup();
    show(DEFAULT_SETTINGS, 'error');
    expect(screen.getByText(en['notices.loadFailed'])).toBeTruthy();
  });

  it('will not turn a notice on without text', () => {
    show();
    const maintenance = card(MAINTENANCE);
    fireEvent.click(within(maintenance).getByRole('checkbox'));
    expect(within(maintenance).getByText(en['notices.problem.empty-while-on'])).toBeTruthy();
    expect(saveButton(MAINTENANCE).disabled).toBe(true);
  });

  it('saves the maintenance notice and keeps the others as stored', async () => {
    const stored: PlatformSettings = {
      ...DEFAULT_SETTINGS,
      announcement: { ...EMPTY_NOTICE, enabled: true, messageAr: 'عرض', messageEn: 'Offer', audience: 'customers', kind: 'warning' },
    };
    show(stored);
    fireEvent.click(within(card(MAINTENANCE)).getByRole('checkbox'));
    fireEvent.change(field(MAINTENANCE, en['notices.messageEn']), { target: { value: ' Back at noon ' } });
    fireEvent.click(saveButton(MAINTENANCE));
    await waitFor(() => expect(savePlatformSettings).toHaveBeenCalledTimes(1));
    expect(savePlatformSettings).toHaveBeenCalledWith(
      { ...stored, maintenance: { ...EMPTY_NOTICE, enabled: true, messageEn: ' Back at noon ' } },
      'maintenance',
    );
  });

  it('saves the announcement with its kind and audience', async () => {
    show();
    fireEvent.click(within(card(ANNOUNCEMENT)).getByRole('checkbox'));
    const [kind, audience] = within(card(ANNOUNCEMENT)).getAllByRole('combobox');
    fireEvent.change(kind, { target: { value: 'success' } });
    fireEvent.change(audience, { target: { value: 'companies' } });
    fireEvent.change(field(ANNOUNCEMENT, en['notices.messageAr']), { target: { value: 'إعلان' } });
    fireEvent.click(saveButton(ANNOUNCEMENT));
    await waitFor(() => expect(savePlatformSettings).toHaveBeenCalledTimes(1));
    expect(savePlatformSettings).toHaveBeenCalledWith(
      {
        ...DEFAULT_SETTINGS,
        announcement: { ...EMPTY_NOTICE, enabled: true, messageAr: 'إعلان', audience: 'companies', kind: 'success' },
      },
      'announcement',
    );
  });

  it('refuses a text over 300 characters', () => {
    show();
    fireEvent.change(field(MAINTENANCE, en['notices.messageEn']), { target: { value: 'x'.repeat(301) } });
    expect(within(card(MAINTENANCE)).getByText('Each text can have at most 300 characters.')).toBeTruthy();
    expect(saveButton(MAINTENANCE).disabled).toBe(true);
  });
});

describe('the schedule', () => {
  it('saves a start and an end', async () => {
    show();
    fireEvent.click(within(card(MAINTENANCE)).getByRole('checkbox'));
    fireEvent.change(field(MAINTENANCE, en['notices.messageEn']), { target: { value: 'Upgrade' } });
    fireEvent.change(field(MAINTENANCE, en['notices.startsAt']), { target: { value: '2099-10-05T10:00' } });
    fireEvent.change(field(MAINTENANCE, en['notices.endsAt']), { target: { value: '2099-10-05T12:30' } });
    fireEvent.click(saveButton(MAINTENANCE));
    await waitFor(() => expect(savePlatformSettings).toHaveBeenCalledTimes(1));
    const saved = vi.mocked(savePlatformSettings).mock.calls[0][0].maintenance;
    expect(saved.startsAt).toEqual(new Date(2099, 9, 5, 10, 0));
    expect(saved.endsAt).toEqual(new Date(2099, 9, 5, 12, 30));
  });

  it('refuses an end that is not after the start', () => {
    show();
    fireEvent.change(field(MAINTENANCE, en['notices.startsAt']), { target: { value: '2099-10-05T12:00' } });
    fireEvent.change(field(MAINTENANCE, en['notices.endsAt']), { target: { value: '2099-10-05T11:00' } });
    expect(within(card(MAINTENANCE)).getByText(en['notices.problem.bad-schedule'])).toBeTruthy();
    expect(saveButton(MAINTENANCE).disabled).toBe(true);
  });

  it('says where the notice stands: off, scheduled, showing, or over', () => {
    const base = { ...EMPTY_NOTICE, enabled: true, messageEn: 'Hi' };
    show({ ...DEFAULT_SETTINGS, maintenance: { ...base, startsAt: new Date(Date.now() + 86_400_000) } });
    expect(within(card(MAINTENANCE)).getByRole('status').textContent).toMatch(/^Scheduled: starts /);
    cleanup();
    show({ ...DEFAULT_SETTINGS, maintenance: base });
    expect(within(card(MAINTENANCE)).getByRole('status').textContent).toBe('Showing now.');
    cleanup();
    show({ ...DEFAULT_SETTINGS, maintenance: { ...base, endsAt: new Date(Date.now() - 60_000) } });
    expect(within(card(MAINTENANCE)).getByRole('status').textContent).toMatch(/^Switched on, but it ended /);
    cleanup();
    show();
    expect(within(card(MAINTENANCE)).getByRole('status').textContent).toBe('Off.');
  });

  it('clears a date that was set', () => {
    show({ ...DEFAULT_SETTINGS, maintenance: { ...EMPTY_NOTICE, endsAt: new Date(2099, 9, 5, 12, 30) } });
    const input = field(MAINTENANCE, en['notices.endsAt']);
    expect(input.value).toBe('2099-10-05T12:30');
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');
    expect(saveButton(MAINTENANCE).disabled).toBe(false);
  });
});

describe('the button under a notice', () => {
  it('saves a link with its two labels', async () => {
    show();
    fireEvent.click(within(card(ANNOUNCEMENT)).getByRole('checkbox'));
    fireEvent.change(field(ANNOUNCEMENT, en['notices.messageEn']), { target: { value: 'Sale' } });
    fireEvent.change(field(ANNOUNCEMENT, en['notices.linkUrl']), { target: { value: 'https://example.com/offers' } });
    fireEvent.change(field(ANNOUNCEMENT, en['notices.linkLabelAr']), { target: { value: 'شاهد العروض' } });
    fireEvent.change(field(ANNOUNCEMENT, en['notices.linkLabelEn']), { target: { value: 'See offers' } });
    fireEvent.click(saveButton(ANNOUNCEMENT));
    await waitFor(() => expect(savePlatformSettings).toHaveBeenCalledTimes(1));
    expect(vi.mocked(savePlatformSettings).mock.calls[0][0].announcement.link).toEqual({
      url: 'https://example.com/offers',
      labelAr: 'شاهد العروض',
      labelEn: 'See offers',
    });
  });

  it('refuses a link that is not https, or has no label', () => {
    show();
    fireEvent.change(field(MAINTENANCE, en['notices.linkUrl']), { target: { value: 'http://status.example.com' } });
    expect(within(card(MAINTENANCE)).getByText(en['notices.problem.bad-link'])).toBeTruthy();
    fireEvent.change(field(MAINTENANCE, en['notices.linkUrl']), { target: { value: 'https://status.example.com' } });
    expect(within(card(MAINTENANCE)).getByText(en['notices.problem.link-needs-label'])).toBeTruthy();
    expect(saveButton(MAINTENANCE).disabled).toBe(true);
    fireEvent.change(field(MAINTENANCE, en['notices.linkLabelEn']), { target: { value: 'Status' } });
    expect(saveButton(MAINTENANCE).disabled).toBe(false);
  });

  it('is offered on the maintenance notice as a status or support page', () => {
    show();
    expect(within(card(MAINTENANCE)).getByText(en['notices.maintenance.linkTitle'])).toBeTruthy();
    expect(within(card(ANNOUNCEMENT)).getByText(en['notices.announcement.linkTitle'])).toBeTruthy();
  });
});

describe('the preview on the phone', () => {
  it('shows the announcement in both languages with its kind and button', () => {
    show({
      ...DEFAULT_SETTINGS,
      announcement: {
        ...EMPTY_NOTICE,
        enabled: true,
        messageAr: 'عرض الأسبوع',
        messageEn: 'Offer of the week',
        audience: 'all',
        kind: 'success',
        link: { url: 'https://example.com', labelAr: 'شاهد', labelEn: 'See' },
      },
    });
    const previews = [...card(ANNOUNCEMENT).querySelectorAll('.preview-banner')];
    expect(previews).toHaveLength(2);
    expect(previews.every((p) => p.classList.contains('preview-banner--success'))).toBe(true);
    expect(card(ANNOUNCEMENT).textContent).toContain('عرض الأسبوع');
    expect(card(ANNOUNCEMENT).textContent).toContain('Offer of the week');
    expect(card(ANNOUNCEMENT).textContent).toContain('شاهد');
    expect(card(ANNOUNCEMENT).textContent).toContain('See');
  });

  it('follows what is typed, and falls back to the other language like the apps do', () => {
    show();
    fireEvent.change(field(ANNOUNCEMENT, en['notices.messageEn']), { target: { value: 'Only English' } });
    const banners = [...card(ANNOUNCEMENT).querySelectorAll('.preview-banner')];
    expect(banners).toHaveLength(2);
    expect(banners.map((b) => b.textContent)).toEqual([expect.stringContaining('Only English'), expect.stringContaining('Only English')]);
  });

  it('shows the maintenance screen with the expected time back', () => {
    show({ ...DEFAULT_SETTINGS, maintenance: { ...EMPTY_NOTICE, enabled: true, messageEn: 'Upgrading', endsAt: new Date(2099, 9, 5, 15, 0) } });
    const screens = [...card(MAINTENANCE).querySelectorAll('.preview-screen')];
    expect(screens).toHaveLength(2);
    expect(card(MAINTENANCE).textContent).toContain('Expected back:');
    expect(card(MAINTENANCE).textContent).toContain('العودة المتوقعة:');
    expect(card(MAINTENANCE).textContent).toContain('Under maintenance');
    // With a time back, "try again in a little while" gives way to it, as in the app.
    expect(card(MAINTENANCE).textContent).not.toContain('try again in a little while');
  });

  it('keeps "try again in a little while" when there is no time back', () => {
    show({ ...DEFAULT_SETTINGS, maintenance: { ...EMPTY_NOTICE, enabled: true, messageEn: 'Upgrading' } });
    expect(card(MAINTENANCE).textContent).toContain('Please try again in a little while.');
    expect(card(MAINTENANCE).textContent).not.toContain('Expected back');
  });

  it('puts the Arabic preview right to left and the English one left to right', () => {
    show();
    const frames = [...card(ANNOUNCEMENT).querySelectorAll('.phone')];
    expect(frames.map((f) => f.getAttribute('dir'))).toEqual(['rtl', 'ltr']);
  });
});

describe('the required update', () => {
  it('is off by default and saves a lowest build with its page', async () => {
    show();
    expect(within(card(UPDATE)).getByRole('status').textContent).toBe(en['notices.update.off']);
    fireEvent.change(field(UPDATE, en['notices.update.minBuild']), { target: { value: '6' } });
    expect(saveButton(UPDATE).disabled).toBe(true); // no page to update from yet
    expect(within(card(UPDATE)).getByText(en['notices.update.problem.bad-link'])).toBeTruthy();
    fireEvent.change(field(UPDATE, en['notices.update.url']), { target: { value: 'https://example.com/app.apk' } });
    expect(within(card(UPDATE)).getByRole('status').textContent).toBe('Apps below build 6 are asked to update.');
    fireEvent.click(saveButton(UPDATE));
    await waitFor(() => expect(savePlatformSettings).toHaveBeenCalledTimes(1));
    expect(savePlatformSettings).toHaveBeenCalledWith(
      { ...DEFAULT_SETTINGS, update: { minBuild: 6, url: 'https://example.com/app.apk', messageAr: '', messageEn: '' } },
      'update',
    );
  });

  it('refuses a build that is not a whole number', () => {
    show();
    fireEvent.change(field(UPDATE, en['notices.update.minBuild']), { target: { value: '2.5' } });
    expect(within(card(UPDATE)).getByText(en['notices.update.problem.bad-build'])).toBeTruthy();
    expect(saveButton(UPDATE).disabled).toBe(true);
    fireEvent.change(field(UPDATE, en['notices.update.minBuild']), { target: { value: '-1' } });
    expect(saveButton(UPDATE).disabled).toBe(true);
  });

  it('turns the requirement off with 0 or an empty box', async () => {
    show({ ...DEFAULT_SETTINGS, update: { minBuild: 6, url: 'https://example.com/app.apk', messageAr: '', messageEn: '' } });
    fireEvent.change(field(UPDATE, en['notices.update.minBuild']), { target: { value: '' } });
    expect(within(card(UPDATE)).getByRole('status').textContent).toBe(en['notices.update.off']);
    fireEvent.click(saveButton(UPDATE));
    await waitFor(() => expect(savePlatformSettings).toHaveBeenCalledTimes(1));
    expect(vi.mocked(savePlatformSettings).mock.calls[0][0].update.minBuild).toBe(0);
  });

  it('previews the update screen in both languages, with the admin\'s own message when there is one', () => {
    show({ ...DEFAULT_SETTINGS, update: { minBuild: 6, url: 'https://example.com/app.apk', messageAr: '', messageEn: 'Please update now' } });
    const screens = [...card(UPDATE).querySelectorAll('.preview-screen')];
    expect(screens).toHaveLength(2);
    expect(card(UPDATE).textContent).toContain('Please update now');
    expect(card(UPDATE).textContent).toContain('تحديث مطلوب');
  });

  it('warns that only apps that contain the feature can be stopped', () => {
    show();
    expect(within(card(UPDATE)).getByText(/build 6 and later/)).toBeTruthy();
  });
});
