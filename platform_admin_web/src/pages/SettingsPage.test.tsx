// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/feedback';
import { I18nProvider } from '../i18n/I18nProvider';
import { ar, en } from '../i18n/dictionary';
import { saveLanguage } from '../i18n/saveLanguage';
import { setTheme, THEME_STORAGE_KEY } from '../theme/theme';
import { SettingsPage } from './SettingsPage';

const auth = vi.hoisted(() => ({
  state: { status: 'authorized', profile: { uid: 'admin-1' } } as { status: string; profile?: { uid: string } },
}));
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ state: auth.state }) }));
vi.mock('../i18n/saveLanguage', () => ({ saveLanguage: vi.fn() }));
// The notices section is tested on its own; here it must not reach Firestore.
vi.mock('../components/NoticesCard', () => ({ NoticesSection: () => null }));

const renderPage = () =>
  render(
    <I18nProvider>
      <ToastProvider>
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </ToastProvider>
    </I18nProvider>,
  );

/** Language and Appearance start closed: open every closed card, then find the choice. */
const radio = (name: string) => {
  for (const head of document.querySelectorAll('button[aria-expanded="false"]')) fireEvent.click(head);
  return screen.getByRole('radio', { name }) as HTMLInputElement;
};

beforeEach(() => {
  localStorage.clear();
  vi.mocked(saveLanguage).mockReset().mockResolvedValue(true);
  auth.state = { status: 'authorized', profile: { uid: 'admin-1' } };
});
afterEach(cleanup);

describe('Settings page', () => {
  it('starts with its cards closed, each saying its current choice, and opens one when pressed', () => {
    renderPage();
    const heads = [...document.querySelectorAll<HTMLButtonElement>('.disclosure__head')];
    expect(heads.map((h) => h.getAttribute('aria-expanded'))).toEqual(['false', 'false']);
    expect(heads[0].textContent).toContain('English');
    expect(heads[1].textContent).toContain(en['settings.themeSystem']);
    fireEvent.click(heads[0]);
    expect(heads[0].getAttribute('aria-expanded')).toBe('true');
    expect(heads[1].getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(heads[0]);
    expect(heads[0].getAttribute('aria-expanded')).toBe('false');
  });

  it('offers English and العربية and marks the current one', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: en['settings.title'] })).toBeTruthy();
    expect(radio('English').checked).toBe(true);
    expect(radio('العربية').checked).toBe(false);
  });

  it('choosing Arabic changes the page at once, flips to RTL, remembers it and saves it to the profile', async () => {
    renderPage();
    fireEvent.click(radio('العربية'));

    expect(await screen.findByRole('heading', { name: ar['settings.title'] })).toBeTruthy();
    expect(radio('العربية').checked).toBe(true);
    expect(radio('English').checked).toBe(false);
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(localStorage.getItem('platform_admin_locale')).toBe('ar');
    await waitFor(() => expect(saveLanguage).toHaveBeenCalledWith('admin-1', 'ar'));
  });

  it('choosing English again returns to LTR and saves en', async () => {
    localStorage.setItem('platform_admin_locale', 'ar');
    renderPage();
    fireEvent.click(radio('English'));

    expect(await screen.findByRole('heading', { name: en['settings.title'] })).toBeTruthy();
    expect(document.documentElement.dir).toBe('ltr');
    expect(localStorage.getItem('platform_admin_locale')).toBe('en');
    await waitFor(() => expect(saveLanguage).toHaveBeenCalledWith('admin-1', 'en'));
  });

  it('keeps the new language and tells the user when the profile could not be saved', async () => {
    vi.mocked(saveLanguage).mockResolvedValue(false);
    renderPage();
    fireEvent.click(radio('العربية'));

    expect(await screen.findByText(ar['settings.languageSaveFailed'])).toBeTruthy();
    expect(document.documentElement.dir).toBe('rtl');
    expect(localStorage.getItem('platform_admin_locale')).toBe('ar');
  });

  it('does not touch Firestore when nobody is signed in', async () => {
    auth.state = { status: 'signedOut' };
    renderPage();
    fireEvent.click(radio('العربية'));

    expect(await screen.findByRole('heading', { name: ar['settings.title'] })).toBeTruthy();
    expect(saveLanguage).not.toHaveBeenCalled();
  });

  it('does nothing when the current language is picked again', () => {
    renderPage();
    fireEvent.click(radio('English'));
    expect(saveLanguage).not.toHaveBeenCalled();
  });
});

describe('Settings page appearance', () => {
  beforeEach(() => setTheme('system'));
  afterEach(() => setTheme('system'));

  it('follows the device until another look is chosen', () => {
    renderPage();
    expect(radio(en['settings.themeSystem']).checked).toBe(true);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('lets the admin force the dark or the light look, and remembers it in this browser', () => {
    renderPage();
    fireEvent.click(radio(en['settings.themeDark']));
    expect(radio(en['settings.themeDark']).checked).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    fireEvent.click(radio(en['settings.themeLight']));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('goes back to the device with "same as the device"', () => {
    renderPage();
    fireEvent.click(radio(en['settings.themeDark']));
    fireEvent.click(radio(en['settings.themeSystem']));
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('is named in Arabic too', () => {
    localStorage.setItem('platform_admin_locale', 'ar');
    renderPage();
    expect(radio(ar['settings.themeDark'])).toBeTruthy();
    expect(screen.getByText(ar['settings.theme'])).toBeTruthy();
  });
});
