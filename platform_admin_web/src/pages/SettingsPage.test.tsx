// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/feedback';
import { I18nProvider } from '../i18n/I18nProvider';
import { ar, en } from '../i18n/dictionary';
import { saveLanguage } from '../i18n/saveLanguage';
import { SettingsPage } from './SettingsPage';

const auth = vi.hoisted(() => ({
  state: { status: 'authorized', profile: { uid: 'admin-1' } } as { status: string; profile?: { uid: string } },
}));
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ state: auth.state }) }));
vi.mock('../i18n/saveLanguage', () => ({ saveLanguage: vi.fn() }));

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

const radio = (name: string) => screen.getByRole('radio', { name }) as HTMLInputElement;

beforeEach(() => {
  localStorage.clear();
  vi.mocked(saveLanguage).mockReset().mockResolvedValue(true);
  auth.state = { status: 'authorized', profile: { uid: 'admin-1' } };
});
afterEach(cleanup);

describe('Settings page', () => {
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
